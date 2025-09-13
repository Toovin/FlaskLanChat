import os

# Configuration constants (inlined for compatibility)
UPLOAD_DIR = 'static/uploads'
THUMBNAILS_DIR = 'static/thumbnails/uploads'

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
                from PIL import Image
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

def generate_thumbnails():
    """Generate thumbnails for images in UPLOAD_DIR if they don't exist."""
    upload_path = UPLOAD_DIR
    thumbnails_path = os.path.join('static', 'thumbnails', 'uploads')
    valid_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

    try:
        os.makedirs(thumbnails_path, exist_ok=True)
        print(f"Ensured thumbnail directory exists: {thumbnails_path}")

        for filename in os.listdir(upload_path):
            if filename.lower().endswith(tuple(valid_extensions)):
                file_path = os.path.join(upload_path, filename)
                if not os.path.isfile(file_path):
                    print(f"Skipping non-file entry: {file_path}")
                    continue
                thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                thumbnail_filepath = os.path.join(thumbnails_path, thumbnail_filename)
                if not os.path.exists(thumbnail_filepath):
                    print(f"Generating thumbnail for {filename}")
                    if generate_thumbnail(file_path, thumbnail_filepath):
                        print(f"Generated thumbnail: {thumbnail_filepath}")
                    else:
                        print(f"Failed to generate thumbnail for {filename}")
                else:
                    print(f"Thumbnail already exists: {thumbnail_filepath}")
            else:
                print(f"Skipping non-image file: {filename}")
    except Exception as e:
        print(f"Error processing thumbnails: {str(e)}")

if __name__ == "__main__":
    generate_thumbnails()