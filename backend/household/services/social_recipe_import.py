"""Social media recipe import (Instagram/TikTok/YouTube/etc. video links) --
downloads just the audio track with yt-dlp, transcribes it with OpenAI's
Whisper API, and feeds the transcript (plus the post's own caption, which
often already has the ingredient list) through the existing Claude
text-extraction path in recipe_import.py.

This is the video-transcription upgrade that was deliberately deferred when
the paste-text importer was built (see recipe_import.py's module docstring
and PLANNING.md item D, 2026-09-30 discussion) -- paste-text already covers
captions that spell out the recipe; this covers videos that only say it out
loud.

Two things must be configured on the server for this to actually run (both
surfaced read-only in /service-status/, see Settings):
  - OPENAI_API_KEY in backend/.env -- there's no free/local fallback here,
    Anthropic has no speech-to-text offering.
  - the `ffmpeg` binary on PATH, which yt-dlp shells out to for audio
    extraction -- `sudo apt install ffmpeg` on the Pi (see DEPLOYMENT.md),
    not something this app can install itself.
Without either, extraction raises a clear, user-facing SocialImportError
rather than failing silently.
"""
import logging
import os
import shutil
import tempfile

import requests
from django.conf import settings

from . import recipe_import

logger = logging.getLogger(__name__)

WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
WHISPER_MODEL = 'whisper-1'
# Safety cap, not a quality choice -- the Pi has 1GB RAM and limited disk, and
# a recipe video is never long, so anything bigger than this is almost
# certainly the wrong kind of link.
MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024


class SocialImportError(Exception):
    """A user-facing extraction failure -- message is safe to show directly in the UI."""


def ffmpeg_available():
    return bool(shutil.which('ffmpeg'))


def _require_openai_key():
    if not settings.OPENAI_API_KEY:
        raise SocialImportError(
            'Video transcription is not configured (no OPENAI_API_KEY set). '
            'Try pasting the caption text instead, or ask for this to be set up.'
        )


def _require_ffmpeg():
    if not ffmpeg_available():
        raise SocialImportError(
            'ffmpeg is not installed on the server, so audio cannot be extracted from the video. '
            'Try pasting the caption text instead.'
        )


def _download_audio(url, workdir):
    import yt_dlp  # imported lazily -- only needed on this path

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(workdir, 'audio.%(ext)s'),
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '128'}],
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 20,
        'max_filesize': MAX_DOWNLOAD_BYTES,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        logger.warning('Social import: yt-dlp download failed for %s: %s', url, exc)
        raise SocialImportError(
            'Could not download that video. Check the link is public and from a supported platform, '
            'or paste the caption text instead.'
        ) from exc

    audio_path = os.path.join(workdir, 'audio.mp3')
    if not os.path.exists(audio_path):
        logger.warning(
            'Social import: no audio.mp3 produced for %s (workdir has: %s)',
            url, os.listdir(workdir) if os.path.isdir(workdir) else None,
        )
        raise SocialImportError('Could not extract audio from that video. Try pasting the caption text instead.')
    return audio_path, info or {}


def _transcribe(audio_path):
    with open(audio_path, 'rb') as f:
        response = requests.post(
            WHISPER_URL,
            headers={'Authorization': f'Bearer {settings.OPENAI_API_KEY}'},
            data={'model': WHISPER_MODEL},
            files={'file': ('audio.mp3', f, 'audio/mpeg')},
            timeout=120,
        )
    if response.status_code >= 400:
        logger.warning('Social import: Whisper request failed (%s): %s', response.status_code, response.text[:500])
        raise SocialImportError('The transcription request failed. Please try again.')
    return (response.json().get('text') or '').strip()


def extract_from_social_url(url):
    url = (url or '').strip()
    if not url:
        raise SocialImportError('No URL provided.')
    _require_openai_key()
    _require_ffmpeg()

    with tempfile.TemporaryDirectory() as workdir:
        audio_path, info = _download_audio(url, workdir)
        transcript = _transcribe(audio_path)

    caption = (info.get('description') or '').strip()
    title = (info.get('title') or '').strip()
    parts = []
    if title:
        parts.append(f'Title: {title}')
    if caption:
        parts.append(f'Caption: {caption}')
    if transcript:
        parts.append(f'Spoken transcript: {transcript}')
    combined = '\n\n'.join(parts)
    if not combined:
        logger.warning('Social import: no title/caption/transcript at all for %s', url)
        raise SocialImportError('Could not find any usable text (caption or spoken audio) in that video.')

    # Reuses the existing Claude text-extraction path (and its RecipeImportError)
    # so the caller only needs to handle one draft shape either way.
    draft = recipe_import.extract_from_text(combined)
    draft['source_type'] = 'social'
    draft['source'] = url
    return draft
