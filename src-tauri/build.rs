use std::fs;
use std::io;
use std::path::PathBuf;

const DETECTION_URL: &str =
    "https://ocrs-models.s3-accelerate.amazonaws.com/text-detection.rten";
const RECOGNITION_URL: &str =
    "https://ocrs-models.s3-accelerate.amazonaws.com/text-recognition.rten";

fn main() {
    ensure_ocr_models();
    tauri_build::build();
}

fn ensure_ocr_models() {
    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"),
    );
    let models_dir = manifest_dir.join("ocr-models");
    if let Err(err) = fs::create_dir_all(&models_dir) {
        println!("cargo:warning=Could not create ocr-models dir: {err}");
        return;
    }

    let models = [
        ("text-detection.rten", DETECTION_URL),
        ("text-recognition.rten", RECOGNITION_URL),
    ];

    for (name, url) in models {
        let path = models_dir.join(name);
        println!("cargo:rerun-if-changed=ocr-models/{name}");
        if path.exists() {
            continue;
        }

        println!("cargo:warning=Downloading OCR model {name} (first build only)…");
        match download_file(url, &path) {
            Ok(()) => println!("cargo:warning=OCR model saved to {}", path.display()),
            Err(err) => {
                println!(
                    "cargo:warning=Failed to download OCR model {name}: {err}. \
                     Image OCR will be unavailable until models are present in src-tauri/ocr-models/"
                );
            }
        }
    }
}

fn download_file(url: &str, dest: &PathBuf) -> io::Result<()> {
    let response = ureq::get(url).call().map_err(|e| io::Error::other(e))?;
    let mut reader = response.into_reader();
    let mut bytes = Vec::new();
    io::Read::read_to_end(&mut reader, &mut bytes)?;
    fs::write(dest, bytes)
}
