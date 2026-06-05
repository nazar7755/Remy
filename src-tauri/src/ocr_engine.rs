use image::imageops::FilterType;
use image::RgbImage;
use ocrs::{ImageSource, OcrEngine, OcrEngineParams};
use rten::Model;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

/// Master switch — OCR postponed until a safer worker process exists.
pub const OCR_INDEXING_ENABLED: bool = false;

/// Hard safety cap — frontend settings may enforce a lower limit.
pub const OCR_ABSOLUTE_MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const OCR_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];
/// Downscale before OCR to limit memory use on large screenshots.
const OCR_MAX_DIMENSION: u32 = 2400;

static ENGINE: OnceLock<Mutex<Option<OcrEngine>>> = OnceLock::new();

pub fn is_ocr_image(extension: &str) -> bool {
    OCR_IMAGE_EXTENSIONS.contains(&extension)
}

/// Load OCR models once at app startup. No-op when OCR is disabled.
pub fn init(models_dir: &Path) {
    if !OCR_INDEXING_ENABLED {
        return;
    }
    let _ = ENGINE.get_or_init(|| Mutex::new(load_engine(models_dir)));
}

fn load_engine(models_dir: &Path) -> Option<OcrEngine> {
    let detection_path = models_dir.join("text-detection.rten");
    let recognition_path = models_dir.join("text-recognition.rten");

    let detection_model = match Model::load_file(&detection_path) {
        Ok(model) => model,
        Err(err) => {
            eprintln!(
                "OCR detection model not loaded ({}): {err}",
                detection_path.display()
            );
            return None;
        }
    };

    let recognition_model = match Model::load_file(&recognition_path) {
        Ok(model) => model,
        Err(err) => {
            eprintln!(
                "OCR recognition model not loaded ({}): {err}",
                recognition_path.display()
            );
            return None;
        }
    };

    match OcrEngine::new(OcrEngineParams {
        detection_model: Some(detection_model),
        recognition_model: Some(recognition_model),
        ..Default::default()
    }) {
        Ok(engine) => Some(engine),
        Err(err) => {
            eprintln!("OCR engine init failed: {err}");
            None
        }
    }
}

fn with_engine<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&OcrEngine) -> Result<T, String>,
{
    let slot = ENGINE
        .get()
        .ok_or_else(|| "OCR engine not initialized".to_string())?;
    let guard = slot
        .lock()
        .map_err(|_| "OCR engine lock poisoned".to_string())?;
    let engine = guard
        .as_ref()
        .ok_or_else(|| "OCR engine unavailable (models missing)".to_string())?;
    f(engine)
}

fn load_image_for_ocr(path: &Path) -> Result<RgbImage, String> {
    let img = image::open(path).map_err(|e| format!("Could not decode image: {e}"))?;
    let rgb = img.into_rgb8();
    let (width, height) = rgb.dimensions();
    if width <= OCR_MAX_DIMENSION && height <= OCR_MAX_DIMENSION {
        return Ok(rgb);
    }

    let scale = OCR_MAX_DIMENSION as f32 / width.max(height) as f32;
    let new_w = ((width as f32 * scale).round() as u32).max(1);
    let new_h = ((height as f32 * scale).round() as u32).max(1);
    Ok(image::imageops::resize(&rgb, new_w, new_h, FilterType::Triangle))
}

pub fn extract_text_from_image(path: &Path) -> Result<String, String> {
    if !OCR_INDEXING_ENABLED {
        return Err("OCR image indexing is disabled".to_string());
    }
    let rgb = load_image_for_ocr(path)?;
    let (width, height) = rgb.dimensions();

    with_engine(|engine| {
        let img_source = ImageSource::from_bytes(rgb.as_raw(), (width, height))
            .map_err(|e| format!("OCR image prepare failed: {e}"))?;

        let ocr_input = engine
            .prepare_input(img_source)
            .map_err(|e| format!("OCR input failed: {e}"))?;

        let word_rects = engine
            .detect_words(&ocr_input)
            .map_err(|e| format!("OCR detection failed: {e}"))?;

        let line_rects = engine.find_text_lines(&ocr_input, &word_rects);

        let line_texts = engine
            .recognize_text(&ocr_input, &line_rects)
            .map_err(|e| format!("OCR recognition failed: {e}"))?;

        let lines: Vec<String> = line_texts
            .iter()
            .flatten()
            .map(|line| line.to_string())
            .filter(|line| line.len() > 1)
            .collect();

        if lines.is_empty() {
            return Err("No text detected in image".to_string());
        }

        Ok(lines.join("\n"))
    })
}
