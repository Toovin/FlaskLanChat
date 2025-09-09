# extensions/chicken_pic.py
# this was implemented for calling out to a mediamtx instance streaming from a raspberry pi
# this will
import requests
import os
import uuid
import json
import cv2
import logging
from datetime import datetime
from PIL import Image
import io
import time

# Set up logging
logger = logging.getLogger('chicken_pic')

# Configuration - can be overridden via config.json
CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'chicken_pic_config.json')

def setup(command_processor):
    """
    Setup function to register the 'chicken' command with the CommandProcessor.
    This extension captures a frame from an RTSP stream and sends it to the chat.
    """
    # Load configuration
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        logger.warning(f"Config file {CONFIG_PATH} not found. Using defaults.")
        config = {
            "rtsp_url": "rtsp://192.168.1.101:8554/cam",
            "timeout_seconds": 10,
            "snapshot_dir": "snapshots"
        }

    rtsp_url = config.get("rtsp_url", "rtsp://192.168.1.101:8554/cam")
    timeout_seconds = config.get("timeout_seconds", 10)
    snapshot_dir = config.get("snapshot_dir", "snapshots")

    # Ensure directory exists
    os.makedirs(snapshot_dir, exist_ok=True)

    def capture_chicken(args, sender, channel):
        """
        Command: !chicken
        Captures a frame from the RTSP stream and sends it to the chat as an image.
        """
        logger.info(f"Chicken command invoked by {sender}")

        # Create a temporary file to store the image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chicken_{timestamp}.jpg"
        filepath = os.path.join(snapshot_dir, filename)

        try:
            # Attempt to capture frame
            frame = capture_frame_from_rtsp(rtsp_url, timeout_seconds)
            if frame is None:
                return {
                    'message': 'Reeeee, failed to capture chicken image. Stream may be unreachable or unresponsive.'
                }

            # Save the frame
            cv2.imwrite(filepath, frame)
            logger.info(f"Chicken image captured and saved: {filepath}")

            # Read image and convert to JPEG bytes
            image = Image.open(filepath)
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG')
            buffer.seek(0)

            # Return image data for display in chat
            return {
                'image_data': buffer.getvalue(),
                'is_image': True
            }

        except Exception as e:
            logger.error(f"Unexpected error in chicken_pic: {str(e)}")
            return {
                'message': f'Reeeee, error capturing chicken: {str(e)}'
            }

    command_processor.register_command('chicken', capture_chicken)

    logger.info("✅ chicken_pic extension loaded successfully.")


def capture_frame_from_rtsp(rtsp_url, timeout_seconds):
    """
    Capture a single frame from an RTSP stream using OpenCV.

    Args:
        rtsp_url (str): The RTSP stream URL.
        timeout_seconds (int): Connection timeout in seconds.

    Returns:
        numpy.ndarray or None: The captured frame, or None if failed.
    """
    logger.debug(f"Attempting to capture frame from RTSP: {rtsp_url}")

    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)

    # Set connection timeout (in milliseconds)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_seconds * 1000)

    if not cap.isOpened():
        logger.error(f"Failed to open RTSP stream: {rtsp_url}")
        return None

    logger.debug("RTSP stream opened successfully")

    # Read a frame with retry logic
    max_attempts = 3
    frame = None
    ret = False

    for attempt in range(max_attempts):
        logger.debug(f"Attempt {attempt + 1} to read frame from RTSP")
        ret, frame = cap.read()

        if ret and frame is not None:
            logger.debug(f"Frame read successfully on attempt {attempt + 1}")
            break
        else:
            logger.warning(f"Failed to read frame on attempt {attempt + 1}")
            time.sleep(0.5)

    if not ret or frame is None:
        logger.error("Failed to read frame after all attempts")
        cap.release()
        return None

    # Clean up
    cap.release()

    return frame
