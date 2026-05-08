"""Pre-download the faster-whisper model so first runtime call isn't slow.

Run after `pip install -r requirements.txt`:

    python -m backend.scripts.download_whisper
"""
from faster_whisper import WhisperModel

from backend.config.settings import get_settings


def main() -> None:
    settings = get_settings()
    print(
        f"Downloading faster-whisper model={settings.whisper_model} "
        f"device={settings.whisper_device} compute_type={settings.whisper_compute_type} ..."
    )
    WhisperModel(
        settings.whisper_model,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
    )
    print("Done. Model cached under ~/.cache/huggingface/")


if __name__ == "__main__":
    main()
