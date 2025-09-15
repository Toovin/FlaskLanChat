import requests
import base64
import io
from PIL import Image
import os
import json
from datetime import datetime
import re


UPLOAD_DIR = 'J:/pythonProject/FlaskLanChat_Dev/dev5/static/uploads'
THUMBNAILS_DIR = 'J:/pythonProject/FlaskLanChat_Dev/dev5/static/thumbnails/uploads'

def sanitize_filename(text, max_length=30):
    """
    Sanitize text for use as filename by removing/replacing special characters
    that can cause filesystem or command execution issues.
    """
    if not text:
        return "generated_image"

    # Convert to string if not already
    text = str(text)

    # Remove or replace problematic characters
    # Keep only alphanumeric, spaces, hyphens, and underscores
    # This regex removes: quotes, exclamation marks, slashes, colons, etc.
    sanitized = re.sub(r'[^\w\s\-_]', '', text)

    # Replace spaces with underscores
    sanitized = sanitized.replace(' ', '_')

    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)

    # Remove leading/trailing underscores and whitespace
    sanitized = sanitized.strip('_ \t\n\r')

    # Ensure it's not empty after sanitization
    if not sanitized or sanitized.isspace():
        sanitized = "generated_image"

    # Truncate to max length
    return sanitized[:max_length]

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

        # Read image with OpenCV
        import cv2
        import numpy as np
        img = cv2.imread(image_path)
        if img is None:
            print(f"OpenCV failed to load image: {image_path}, trying PIL")
            # Fallback to PIL
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

    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {str(e)}")
        return False

def load_samplers(api_url):
    """Fetch samplers from the API with fallback defaults."""
    try:
        response = requests.get(f"{api_url.rstrip('/')}/sdapi/v1/samplers", timeout=10)
        response.raise_for_status()
        samplers = response.json()
        return [
            {
                'value': s['name'],
                'label': s.get('label', s['name']),
                'recommended_scheduler': s.get('options', {}).get('scheduler', None)
            }
            for s in samplers
        ]
    except requests.RequestException as e:
        print(f"Failed to fetch samplers from API: {str(e)}. Using fallback.")
        return [
            {'value': 'Euler', 'label': 'Euler', 'recommended_scheduler': None},
            {'value': 'DPM++ 3M SDE', 'label': 'DPM++ 3M SDE', 'recommended_scheduler': 'exponential'}
        ]

def load_schedulers(api_url):
    """Fetch schedulers from the API with fallback defaults."""
    try:
        response = requests.get(f"{api_url.rstrip('/')}/sdapi/v1/schedulers", timeout=10)
        response.raise_for_status()
        schedulers = response.json()
        return [{'value': s['name'], 'label': s.get('label', s['name'])} for s in schedulers]
    except requests.RequestException as e:
        print(f"Failed to fetch schedulers from API: {str(e)}. Using fallback.")
        return [
            {'value': 'Simple', 'label': 'Simple'},
            {'value': 'exponential', 'label': 'Exponential'}
        ]

def setup(command_processor):
    """Setup function to register commands with the CommandProcessor."""
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), '..', 'sd_config.json')
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError("sd_config.json not found")
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON in sd_config.json")

    # Load samplers and schedulers from API
    base_api_url = config.get('sd_api_url', 'http://127.0.0.1:7872')
    try:
        SAMPLERS = load_samplers(base_api_url)
        SCHEDULERS = load_schedulers(base_api_url)
        print(f"Successfully loaded {len(SAMPLERS)} samplers and {len(SCHEDULERS)} schedulers from API")
    except Exception as e:
        print(f"Failed to load samplers or schedulers from API: {str(e)}. Using fallbacks.")
        SAMPLERS = [
            {'value': 'Euler', 'label': 'Euler', 'recommended_scheduler': None},
            {'value': 'DPM++ 3M SDE', 'label': 'DPM++ 3M SDE', 'recommended_scheduler': 'exponential'}
        ]
        SCHEDULERS = [
            {'value': 'Simple', 'label': 'Simple'},
            {'value': 'exponential', 'label': 'Exponential'}
        ]

    api_url = f"{base_api_url.rstrip('/')}/sdapi/v1/txt2img"
    default_width = config.get('default_width', 1024)
    default_height = config.get('default_height', 1024)
    default_steps = config.get('default_steps', 35)
    default_cfg_scale = config.get('default_cfg_scale', 7)
    default_negative_prompt = config.get('negative_prompt', '')
    default_sampler_name = config.get('sampler_name', 'DPM++ 3M SDE')
    default_scheduler_name = config.get('scheduler_name', 'exponential')
    default_clip_skip = 2
    default_batch_size = 1

    def image(args, sender, channel):
        """Command: !image [prompt] - Opens modal with optional prompt prefill, or generates with form data."""
        print(f"Processing !image command from {sender} in channel {channel}")
        if not args or not isinstance(args, dict):
            prompt_prefill = args.strip() if args else ''
            print(f"Opening modal with prompt prefill: '{prompt_prefill}'")
            return {
                'modal_data': {
                    'open_modal': True,
                    'prompt': prompt_prefill,
                    'width': default_width,
                    'height': default_height,
                    'steps': default_steps,
                    'cfg_scale': default_cfg_scale,
                    'clip_skip': default_clip_skip,
                    'negative_prompt': default_negative_prompt,
                    'sampler_name': default_sampler_name,
                    'scheduler_name': default_scheduler_name,
                    'batch_size': default_batch_size,
                    'sampler_options': SAMPLERS,
                    'scheduler_options': SCHEDULERS
                }
            }

        # Handle form submission
        form_data = args
        prompt = form_data.get('prompt', '')
        width = int(form_data.get('width', default_width))
        height = int(form_data.get('height', default_height))
        steps = int(form_data.get('steps', default_steps))
        cfg_scale = float(form_data.get('cfg_scale', default_cfg_scale))
        clip_skip = int(form_data.get('clip_skip', default_clip_skip))
        negative_prompt = form_data.get('negative_prompt', default_negative_prompt)
        sampler_name = form_data.get('sampler_name', default_sampler_name)
        scheduler_name = form_data.get('scheduler_name', default_scheduler_name)
        num_images = max(1, min(int(form_data.get('batch_size', default_batch_size)), 4))
        if form_data.get('cancel') is True:
            print(f"Cancel requested for !image by {sender}")
            return None

        if not prompt.strip():
            print("Empty prompt provided")
            return {'message': 'Reeeee, prompt is empty! Please provide a description.', 'is_media': False}

        # Generate with native batch_size (single API call)
        payload = {
            'prompt': prompt,
            'negative_prompt': negative_prompt,
            'steps': steps,
            'width': width,
            'height': height,
            'cfg_scale': cfg_scale,
            'clip_skip': clip_skip,
            'sampler_name': sampler_name,
            'scheduler': scheduler_name,
            'seed': -1,
            'batch_size': num_images
        }
        print(f"Sending txt2img request to {api_url}: {payload}")
        try:
            response = requests.post(api_url, json=payload, timeout=240)
            print(f"API response status: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            print(f"API response received: {len(result.get('images', []))} images")
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"Response text: {e.response.text}")
            return {'message': f"Reeeee, image generation failed: {str(e)}", 'is_media': False}

        upload_path = UPLOAD_DIR
        thumbnails_path = THUMBNAILS_DIR
        os.makedirs(upload_path, exist_ok=True)
        os.makedirs(thumbnails_path, exist_ok=True)

        if 'images' in result and result['images']:
            num_images = len(result['images'])
            print(f"Processing {num_images} images from batch")

            if num_images == 1:
                # Single image - use existing format for backward compatibility
                image_data = result['images'][0]
                image_bytes = base64.b64decode(image_data)
                image = Image.open(io.BytesIO(image_bytes))

                # Use sanitized prompt-based name with timestamp
                base_name = sanitize_filename(prompt)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{base_name}_{timestamp}.jpg"
                file_path = os.path.join(upload_path, filename)
                counter = 1
                while os.path.exists(file_path):
                    filename = f"{base_name}_{timestamp}_{counter}.jpg"
                    file_path = os.path.join(upload_path, filename)
                    counter += 1

                # Save image
                image.save(file_path, format='JPEG', quality=85)
                print(f"Image saved: {file_path}")
                image_url = f"/static/uploads/{filename}".replace('\\', '/')

                # Generate thumbnail
                thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                thumbnail_filepath = os.path.join(thumbnails_path, thumbnail_filename)
                thumbnail_url = None
                if generate_thumbnail(file_path, thumbnail_filepath):
                    thumbnail_url = f"/static/thumbnails/uploads/{thumbnail_filename}".replace('\\', '/')
                    if not os.path.exists(thumbnail_filepath):
                        print(f"Thumbnail file not found after generation: {thumbnail_filepath}")
                        thumbnail_url = image_url
                else:
                    print(f"Thumbnail generation failed for {filename}")
                    thumbnail_url = image_url  # Fallback to full image

                print("Generated single image")
                return {
                    'message': f"Image generated: {prompt}",
                    'is_media': True,
                    'image_url': image_url,
                    'thumbnail_url': thumbnail_url,
                    'sender': sender
                }
            else:
                # Multiple images - create carousel format
                attachments = []
                base_name = sanitize_filename(prompt, 25)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

                for i, image_data in enumerate(result['images']):
                    image_bytes = base64.b64decode(image_data)
                    image = Image.open(io.BytesIO(image_bytes))

                    # Create unique filename for each image
                    filename = f"{base_name}_{timestamp}_{i+1}.jpg"
                    file_path = os.path.join(upload_path, filename)
                    counter = 1
                    while os.path.exists(file_path):
                        filename = f"{base_name}_{timestamp}_{i+1}_{counter}.jpg"
                        file_path = os.path.join(upload_path, filename)
                        counter += 1

                    # Save image
                    image.save(file_path, format='JPEG', quality=85)
                    print(f"Image {i+1}/{num_images} saved: {file_path}")
                    image_url = f"/static/uploads/{filename}".replace('\\', '/')

                    # Generate thumbnail
                    thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                    thumbnail_filepath = os.path.join(thumbnails_path, thumbnail_filename)
                    thumbnail_url = None
                    if generate_thumbnail(file_path, thumbnail_filepath):
                        thumbnail_url = f"/static/thumbnails/uploads/{thumbnail_filename}".replace('\\', '/')
                        if not os.path.exists(thumbnail_filepath):
                            print(f"Thumbnail file not found after generation: {thumbnail_filepath}")
                            thumbnail_url = image_url
                    else:
                        print(f"Thumbnail generation failed for {filename}")
                        thumbnail_url = image_url  # Fallback to full image

                    attachments.append({
                        'url': image_url,
                        'thumbnail_url': thumbnail_url
                    })

                print(f"Generated batch of {num_images} images")
                return {
                    'message': json.dumps({
                        'message': f"Generated {num_images} images: {prompt}",
                        'attachments': attachments
                    }),
                    'is_media': True,
                    'sender': sender
                }

        else:
            print("No image data returned from API")
            return {'message': 'Reeeee, no image data returned from API!', 'is_media': False}

    command_processor.register_command('image', image)