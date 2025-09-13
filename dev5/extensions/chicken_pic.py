import requests
import os
import uuid
import json
import logging
from datetime import datetime
from PIL import Image
import io
import time
from lc_config import UPLOAD_DIR, THUMBNAILS_DIR
import os

# Override THUMBNAILS_DIR to use subdirectory structure
THUMBNAILS_DIR = os.path.join(os.path.dirname(UPLOAD_DIR), 'thumbnails', 'uploads')


# Try to import OpenCV and numpy, but handle gracefully if not available
try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
    print("🐔 OpenCV and numpy loaded successfully")
except ImportError as e:
    print(f"🐔 OpenCV/numpy not available: {e}. Using PIL fallback only.")
    cv2 = None
    np = None
    OPENCV_AVAILABLE = False

def generate_thumbnail(image_path, thumbnail_path, size=(200, 200)):
    """Generate a thumbnail for an image using OpenCV or PIL as fallback"""
    try:
        # Ensure thumbnail directory exists
        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
        print(f"Attempting to generate thumbnail for {image_path} at {thumbnail_path}")

        # Validate image file exists
        if not os.path.exists(image_path):
            print(f"Error: Source image {image_path} does not exist")
            return False

        # Try OpenCV first if available, otherwise use PIL
        if OPENCV_AVAILABLE and cv2 is not None and np is not None:
            # Read image with OpenCV
            img = cv2.imread(image_path)
            if img is None:
                print(f"OpenCV failed to load image: {image_path}, trying PIL")
            else:
                # Get original dimensions
                height, width = img.shape[:2]
                if height == 0 or width == 0:
                    print(f"Error: Invalid image dimensions for {image_path}")
                    return False

                # Calculate aspect ratio
                aspect_ratio = width / height

                # Determine new dimensions maintaining aspect ratio
                if width > height:
                    new_width = size[0]
                    new_height = int(size[0] / aspect_ratio)
                else:
                    new_height = size[1]
                    new_width = int(size[1] * aspect_ratio)

                # Resize image
                resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)

                # Create a canvas of the target size
                canvas = np.full((size[1], size[0], 3), 255, dtype=np.uint8)  # White background

                # Center the resized image on the canvas
                x_offset = (size[0] - new_width) // 2
                y_offset = (size[1] - new_height) // 2
                canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = resized

                # Save thumbnail
                success = cv2.imwrite(thumbnail_path, canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if success:
                    print(f"Thumbnail generated (OpenCV): {thumbnail_path}")
                    return True
                else:
                    print(f"Error: Failed to save thumbnail at {thumbnail_path}")
                    return False

        # Fallback to PIL
        print(f"Using PIL fallback for thumbnail generation: {image_path}")
        try:
            with Image.open(image_path) as pil_img:
                # Convert to RGB if necessary (e.g., for PNG with transparency)
                if pil_img.mode in ('RGBA', 'LA'):
                    pil_img = pil_img.convert('RGB')
                pil_img.thumbnail(size, Image.Resampling.LANCZOS)
                pil_img.save(thumbnail_path, 'JPEG', quality=85)
            print(f"Thumbnail generated (PIL): {thumbnail_path}")
            return True
        except Exception as pil_error:
            print(f"PIL failed to process image {image_path}: {str(pil_error)}")
            return False

    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {str(e)}")
        return False

logger = logging.getLogger('chicken_pic')
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'chicken_pic_config.json')

def setup(command_processor):
    # Use absolute paths to ensure correct location
    global UPLOAD_DIR, THUMBNAILS_DIR
    UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)
    THUMBNAILS_DIR = os.path.abspath(THUMBNAILS_DIR)

    # Look for config in the project root
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'chicken_pic_config.json')
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        logger.warning(f"Config file {config_path} not found. Using defaults.")
        config = {
            "rtsp_url": "rtsp://192.168.1.101:8554/cam",
            "timeout_seconds": 10
        }

    rtsp_url = config.get("rtsp_url", "rtsp://192.168.1.101:8554/cam")
    timeout_seconds = config.get("timeout_seconds", 10)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(THUMBNAILS_DIR, exist_ok=True)

    def capture_chicken(args, sender, channel):
        logger.info(f"Chicken command invoked by {sender} in channel {channel}")
        print(f"🐔 Chicken command invoked by {sender} in channel {channel}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chicken_{timestamp}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)
        image_url = f"/static/uploads/{filename}".replace('\\', '/')

        try:
            print(f"🐔 Checking upload directory: {UPLOAD_DIR}")
            if not os.access(UPLOAD_DIR, os.W_OK):
                logger.error(f"No write permission for {UPLOAD_DIR}")
                return {'message': 'Error: No write permission for upload directory'}

            print(f"🐔 Attempting to capture frame from RTSP: {rtsp_url}")
            frame = capture_frame_from_rtsp(rtsp_url, timeout_seconds)
            if frame is None:
                logger.error("Failed to capture frame from RTSP stream")
                print("🐔 Failed to capture frame from RTSP stream")
                from PIL import Image, ImageDraw
                img = Image.new('RGB', (640, 480), color='yellow')
                draw = ImageDraw.Draw(img)
                draw.text((320, 240), '🐔 Chicken Cam Offline', fill='black', anchor='mm')
                if OPENCV_AVAILABLE and np is not None:
                    frame = np.array(img)
                else:
                    # Save directly with PIL if OpenCV not available
                    img.save(filepath, format='JPEG', quality=85)
                    print(f"🐔 Saved fallback image with PIL: {filepath}")
                    # Bypass thumbnail generation for fallback
                    thumbnail_url = image_url
                    return {
                        'is_media': True,
                        'message': 'Chicken image captured (fallback)!',
                        'image_url': image_url,
                        'thumbnail_url': thumbnail_url,
                        'sender': sender,
                        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                print("🐔 Created fallback test image")

            print(f"🐔 Saving image to: {filepath}")
            if OPENCV_AVAILABLE and cv2 is not None:
                success = cv2.imwrite(filepath, frame)
            else:
                # This shouldn't happen since we handled the None frame case above
                success = False
            if not success:
                logger.error(f"Failed to save image: {filepath}")
                return {'message': 'Reeeee, failed to save chicken image.'}
            logger.info(f"Chicken image saved: {filepath}")

            # Generate thumbnail for chicken images
            thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
            thumbnail_filepath = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
            thumbnail_url = None
            if generate_thumbnail(filepath, thumbnail_filepath):
                thumbnail_url = f"/static/thumbnails/uploads/{thumbnail_filename}".replace('\\', '/')
                if not os.path.exists(thumbnail_filepath):
                    print(f"Thumbnail file not found after generation: {thumbnail_filepath}")
                    thumbnail_url = image_url
            else:
                print(f"Thumbnail generation failed for {filename}")
                thumbnail_url = image_url  # Fallback to full image

            return {
                'is_media': True,
                'message': 'Chicken image captured!',
                'image_url': image_url,
                'thumbnail_url': thumbnail_url,
                'sender': sender,
                'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        except Exception as e:
            logger.error(f"Unexpected error in chicken_pic: {str(e)}", exc_info=True)
            # Return a more user-friendly error message
            return {'message': f'🐔 Oops! Chicken cam had a hiccup: {str(e)[:100]}...'}

    def test_command(args, sender, channel):
        print(f"🐔 Test command invoked by {sender} in channel {channel}")
        return {
            'message': f'🐔 Test command works! Args: {args}'
        }

    command_processor.register_command('chicken', capture_chicken)
    command_processor.register_command('test', test_command)
    logger.info("✅ chicken_pic extension loaded successfully.")
    print("🐔 Chicken and test commands registered successfully!")

def capture_frame_from_rtsp(rtsp_url, timeout_seconds):
    logger.debug(f"Attempting to capture frame from RTSP: {rtsp_url}")
    print(f"🐔 Opening RTSP stream: {rtsp_url}")

    if not OPENCV_AVAILABLE or cv2 is None:
        logger.error("OpenCV not available for RTSP capture")
        print("🐔 OpenCV not available for RTSP capture")
        return None

    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_seconds * 1000)

    if not cap.isOpened():
        logger.error(f"Failed to open RTSP stream: {rtsp_url}")
        print(f"🐔 Failed to open RTSP stream: {rtsp_url}")
        return None

    print(f"🐔 RTSP stream opened successfully")
    logger.debug("RTSP stream opened successfully")

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

    cap.release()
    return frame