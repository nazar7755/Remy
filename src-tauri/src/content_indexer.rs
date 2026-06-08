use crate::ocr_engine;
use std::fs;
use std::io::Read;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use zip::ZipArchive;

const INDEXABLE: &[&str] = &["txt", "pdf", "docx"];
const MAX_CONTENT_CHARS: usize = 200_000;
const PDF_EXTRACT_TIMEOUT_SECS: u64 = 60;
const OCR_EXTRACT_TIMEOUT_SECS: u64 = 120;

/// User-facing message for Details panel and invoke errors.
pub const INDEXING_FAILED_USER_MSG: &str =
    "Indexing failed: unsupported or corrupted file";

#[cfg(debug_assertions)]
fn debug_index(message: &str) {
    eprintln!("[index] {message}");
}

#[cfg(not(debug_assertions))]
fn debug_index(_message: &str) {}

pub fn is_indexable(extension: &str) -> bool {
    INDEXABLE.contains(&extension)
        || (ocr_engine::OCR_INDEXING_ENABLED && ocr_engine::is_ocr_image(extension))
}

pub fn extract_text(path: &Path, extension: &str) -> Result<Option<String>, String> {
    if !is_indexable(extension) {
        return Ok(None);
    }

    let text = match extension {
        "txt" => extract_txt(path),
        "docx" => extract_docx(path),
        ext if ocr_engine::OCR_INDEXING_ENABLED && ocr_engine::is_ocr_image(ext) => {
            extract_ocr_image(path)
        }
        _ => return Ok(None),
    };

    match text {
        Ok(content) => {
            let trimmed = content.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(truncate_chars(trimmed.to_string(), MAX_CONTENT_CHARS)))
            }
        }
        Err(err) => Err(err),
    }
}

fn truncate_chars(mut s: String, max: usize) -> String {
    if s.chars().count() <= max {
        return s;
    }
    s = s.chars().take(max).collect();
    s.push_str("…");
    s
}

fn extract_txt(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

fn extract_ocr_image(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() > ocr_engine::OCR_ABSOLUTE_MAX_FILE_BYTES {
        return Err(format!(
            "Image exceeds maximum size ({} MB)",
            ocr_engine::OCR_ABSOLUTE_MAX_FILE_BYTES / (1024 * 1024)
        ));
    }

    let path_buf = path.to_path_buf();
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let result = catch_ocr_extract(&path_buf);
        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_secs(OCR_EXTRACT_TIMEOUT_SECS)) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => Err(format!(
            "OCR extraction timed out after {OCR_EXTRACT_TIMEOUT_SECS} seconds"
        )),
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("OCR extraction thread exited unexpectedly".to_string())
        }
    }
}

fn catch_ocr_extract(path: &PathBuf) -> Result<String, String> {
    let path_for_panic = path.clone();
    match std::panic::catch_unwind(move || ocr_engine::extract_text_from_image(&path_for_panic)) {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(err)) => Err(err),
        Err(_) => Err(
            "OCR extraction panicked (image may be corrupted or unsupported)".to_string(),
        ),
    }
}

/// PDF-only entry point for indexing. Returns `Ok(None)` for empty extractable text.
pub fn extract_pdf_for_index(path: &Path) -> Result<Option<String>, String> {
    match extract_pdf(path) {
        Ok(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(truncate_chars(trimmed.to_string(), MAX_CONTENT_CHARS)))
            }
        }
        Err(err) => Err(err),
    }
}

fn extract_pdf(path: &Path) -> Result<String, String> {
    let path_buf = path.to_path_buf();
    let (tx, rx) = mpsc::channel();

    thread::Builder::new()
        .name("pdf-extract".into())
        .spawn(move || {
            let result = catch_unwind(|| run_pdf_extract_worker(&path_buf)).unwrap_or_else(|_| {
                debug_index(&format!(
                    "PDF extraction panicked: {} (worker thread unwind)",
                    path_buf.display()
                ));
                Err("PDF extraction panicked (worker thread unwind)".to_string())
            });
            let _ = tx.send(result);
        })
        .map_err(|e| format!("failed to spawn PDF extraction thread: {e}"))?;

    match rx.recv_timeout(Duration::from_secs(PDF_EXTRACT_TIMEOUT_SECS)) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            debug_index(&format!(
                "PDF extraction timed out after {PDF_EXTRACT_TIMEOUT_SECS}s: {}",
                path.display()
            ));
            Err(format!(
                "PDF extraction timed out after {PDF_EXTRACT_TIMEOUT_SECS} seconds"
            ))
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            debug_index(&format!(
                "PDF extraction thread exited unexpectedly: {}",
                path.display()
            ));
            Err("PDF extraction thread exited unexpectedly".to_string())
        }
    }
}

fn run_pdf_extract_worker(path: &PathBuf) -> Result<String, String> {
    let path_for_panic = path.clone();
    let path_label = path.display().to_string();

    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));

    let result = catch_unwind(AssertUnwindSafe(move || pdf_extract::extract_text(&path_for_panic)));

    std::panic::set_hook(prev_hook);

    match result {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(err)) => {
            debug_index(&format!("PDF extraction failed: {path_label}: {err}"));
            Err(err.to_string())
        }
        Err(payload) => {
            let detail = panic_payload_to_string(payload);
            debug_index(&format!("PDF extraction panicked: {path_label}: {detail}"));
            Err(format!("PDF extraction panicked: {detail}"))
        }
    }
}

fn panic_payload_to_string(payload: Box<dyn std::any::Any + Send>) -> String {
    payload
        .downcast_ref::<&str>()
        .map(|s| (*s).to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic payload".to_string())
}

fn extract_docx(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|e| e.to_string())?
        .read_to_string(&mut xml)
        .map_err(|e| e.to_string())?;

    let mut reader = quick_xml::Reader::from_str(&xml);
    reader.config_mut().trim_text(true);

    let mut text = String::new();
    let mut in_text_node = false;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(e)) => {
                if e.local_name().as_ref() == b"t" {
                    in_text_node = true;
                }
            }
            Ok(quick_xml::events::Event::Text(e)) => {
                if in_text_node {
                    let decoded = e.unescape().map_err(|e| e.to_string())?;
                    text.push_str(&decoded);
                }
            }
            Ok(quick_xml::events::Event::End(e)) => {
                if e.local_name().as_ref() == b"t" {
                    in_text_node = false;
                    text.push(' ');
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(e.to_string()),
            _ => {}
        }
        buf.clear();
    }

    Ok(text)
}
