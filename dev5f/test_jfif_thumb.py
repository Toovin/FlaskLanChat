#!/usr/bin/env python3
"""
Test script to manually test thumbnail generation on JFIF files
"""

import sys
import os
from pathlib import Path
from PIL import Image

def generate_thumbnail(image_path, thumbnail_path, size=(200, 200)):
    """Generate a thumbnail for an image using PIL"""
    try:
        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
        print(f"Attempting to generate thumbnail for {image_path} at {thumbnail_path}")

        if not os.path.exists(image_path):
            print(f"Error: Source image {image_path} does not exist")
            return False

        # Use PIL for thumbnail generation
        print(f"Using PIL for thumbnail generation: {image_path}")
        try:
            with Image.open(image_path) as pil_img:
                print(f"Image opened successfully. Mode: {pil_img.mode}, Size: {pil_img.size}")
                # Convert to RGB if necessary (e.g., for PNG with transparency)
                if pil_img.mode in ('RGBA', 'LA'):
                    print("Converting image to RGB")
                    pil_img = pil_img.convert('RGB')
                print(f"Creating thumbnail with size: {size}")
                pil_img.thumbnail(size, Image.Resampling.LANCZOS)
                print(f"Saving thumbnail to: {thumbnail_path}")
                pil_img.save(thumbnail_path, 'JPEG', quality=85)
            print(f"Thumbnail generated (PIL): {thumbnail_path}")
            return True
        except Exception as pil_error:
            print(f"PIL failed to process image {image_path}: {str(pil_error)}")
            import traceback
            traceback.print_exc()
            return False

    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_jfif_thumbnail():
    """Test thumbnail generation on a JFIF file"""

    # Test on one of the problematic JFIF files
    source_file = "static/uploads/GujXii3WAAEDY1p_20250912_005223.jfif"
    thumb_file = "static/thumbnails/uploads/test_thumb.jpg"

    print(f"Testing thumbnail generation:")
    print(f"Source: {source_file}")
    print(f"Thumbnail: {thumb_file}")

    if not os.path.exists(source_file):
        print(f"ERROR: Source file does not exist: {source_file}")
        return False

    print(f"Source file exists, size: {os.path.getsize(source_file)} bytes")

    try:
        result = generate_thumbnail(source_file, thumb_file)
        print(f"generate_thumbnail returned: {result}")

        if result and os.path.exists(thumb_file):
            size = os.path.getsize(thumb_file)
            print(f"Thumbnail created successfully, size: {size} bytes")
            return True
        else:
            print("Thumbnail generation failed or file not created")
            return False

    except Exception as e:
        print(f"Exception during thumbnail generation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_jfif_thumbnail()
    print(f"\nTest result: {'PASS' if success else 'FAIL'}")