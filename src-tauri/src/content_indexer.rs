use std::fs;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

const INDEXABLE: &[&str] = &["txt", "pdf", "docx"];
const MAX_CONTENT_CHARS: usize = 200_000;

pub fn is_indexable(extension: &str) -> bool {
    INDEXABLE.contains(&extension)
}

pub fn extract_text(path: &Path, extension: &str) -> Option<String> {
    if !is_indexable(extension) {
        return None;
    }

    let text = match extension {
        "txt" => extract_txt(path),
        "pdf" => extract_pdf(path),
        "docx" => extract_docx(path),
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

fn extract_pdf(path: &Path) -> Result<String, String> {
    pdf_extract::extract_text(path).map_err(|e| e.to_string())
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
