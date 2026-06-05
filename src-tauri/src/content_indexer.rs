use crate::ocr_engine;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use zip::ZipArchive;

const INDEXABLE: &[&str] = &["txt", "pdf", "docx"];
const MAX_CONTENT_CHARS: usize = 200_000;
const PDF_EXTRACT_TIMEOUT_SECS: u64 = 60;
const OCR_EXTRACT_TIMEOUT_SECS: u64 = 120;

pub fn is_indexable(extension: &str) -> bool {
    INDEXABLE.contains(&extension)
        || (ocr_engine::OCR_INDEXING_ENABLED && ocr_engine::is_ocr_image(extension))
}

pub fn extract_text(path: &Path, extension: &str) -> Option<String> {
    if !is_indexable(extension) {
        return None;
    }

    let text = match extension {
        "txt" => extract_txt(path),
        "pdf" => extract_pdf(path),
        "docx" => extract_docx(path),
        ext if ocr_engine::OCR_INDEXING_ENABLED && ocr_engine::is_ocr_image(ext) => {
            extract_ocr_image(path)
        }
        _ => return None,
    };

    match text {
        Ok(content) => {
            let trimmed = content.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(truncate_chars(trimmed.to_string(), MAX_CONTENT_CHARS))
            }
        }
        Err(err) => {
            eprintln!("content index failed for {}: {}", path.display(), err);
            None
        }
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

fn extract_pdf(path: &Path) -> Result<String, String> {
    let path_buf = path.to_path_buf();
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let result = catch_pdf_extract(&path_buf);
        let _ = tx.send(result);
    });

    match rx.recv_timeout(Duration::from_secs(PDF_EXTRACT_TIMEOUT_SECS)) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => Err(format!(
            "PDF extraction timed out after {PDF_EXTRACT_TIMEOUT_SECS} seconds"
        )),
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("PDF extraction thread exited unexpectedly".to_string())
        }
    }
}

fn catch_pdf_extract(path: &PathBuf) -> Result<String, String> {
    let path_for_panic = path.clone();
    match std::panic::catch_unwind(move || pdf_extract::extract_text(&path_for_panic)) {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(err)) => Err(err.to_string()),
        Err(_) => Err(
            "PDF extraction panicked (file may be corrupted or unsupported)".to_string(),
        ),
    }
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
