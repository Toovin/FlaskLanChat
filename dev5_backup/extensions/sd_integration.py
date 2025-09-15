import requests
import base64
import io
from PIL import Image
import os
import json
from datetime import datetime
# from lc_config import UPLOAD_DIR


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
    try:
        base_api_url = config.get('sd_api_url', 'http://127.0.0.1:7860')
        SAMPLERS = load_samplers(base_api_url)
        SCHEDULERS = load_schedulers(base_api_url)
    except Exception as e:
        raise Exception(f"Failed to load samplers or schedulers: {str(e)}")

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
        """Command: !image [prompt] - Opens modal or generates image(s) with form data."""
        print(f"Processing !image command from {sender} in channel {channel}")
        if not args:
            print("No args provided, opening modal")
            return {
                'open_modal': True,
                'prompt': '',
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

        try:
            form_data = {}
            prompt = ''
            sampler_name = default_sampler_name
            scheduler_name = default_scheduler_name
            if isinstance(args, dict):
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
                    return {'cancel': True}
            else:
                prompt = args.strip()
                width = default_width
                height = default_height
                steps = default_steps
                cfg_scale = default_cfg_scale
                clip_skip = default_clip_skip
                negative_prompt = default_negative_prompt
                num_images = 1  # Default for command-line !image <prompt>

            if not prompt.strip():
                print("Empty prompt provided")
                return {'message': 'Reeeee, prompt is empty! Please provide a description.'}

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
            print(f"Sending txt2img request: {payload}")
            response = requests.post(api_url, json=payload, timeout=240)
            response.raise_for_status()
            result = response.json()

            urls = []
            upload_path = "static/uploads"  # Use static/uploads
            os.makedirs(upload_path, exist_ok=True)
            if 'images' in result and result['images']:
                for index, image_data in enumerate(result['images']):
                    image_bytes = base64.b64decode(image_data)
                    image = Image.open(io.BytesIO(image_bytes))

                    # Use prompt-based name with index for batch
                    base_name = prompt[:30].replace(' ', '_').replace(',', '').replace('.', '')
                    filename = f"{base_name}_{index + 1}.jpg"
                    file_path = os.path.join(upload_path, filename)
                    counter = 1
                    while os.path.exists(file_path):
                        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        filename = f"{base_name}_{index + 1}_{timestamp}_{counter}.jpg"
                        file_path = os.path.join(upload_path, filename)
                        counter += 1

                    # Save image directly
                    image.save(file_path, format='jpeg')
                    print(f"Image saved: {file_path}")
                    url = f"/{upload_path}/{filename}".replace('\\', '/')
                    urls.append(url)
            else:
                print("No image data returned from API")
                return {'message': 'Reeeee, no image data returned from API!'}

            if len(urls) > 1:
                print(f"Generated {len(urls)} images")
                return {
                    'message': json.dumps({
                        'text': f"Batch of {len(urls)} images generated",
                        'attachments': urls
                    }),
                    'is_media': True
                }
            elif urls:
                print("Generated single image")
                return {
                    'message': urls[0],
                    'is_media': True
                }
            else:
                print("No images generated")
                return {'message': 'Reeeee, no images generated!'}

        except requests.exceptions.RequestException as e:
            print(f"Image generation failed: {str(e)}")
            return {'message': f"Reeeee, image generation failed: {str(e)}"}
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return {'message': f"Reeeee, unexpected error: {str(e)}"}

    command_processor.register_command('image', image)
