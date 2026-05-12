#!/usr/bin/env python3
"""
Image Compression Script for Website Optimization
--------------------------------------------------
Compresses images in-place while preserving file paths and names.
Run this script from your website root directory (where 'images/' folder exists).

Usage:
    python compress_images.py [options]

Options:
    --quality INT     JPEG/WebP quality (1-100, default: 80)
    --max-width INT   Maximum width in pixels (default: 1920)
    --dry-run         Show what would be compressed without actually doing it
    --verbose         Show detailed output for each image

Requirements:
    pip install Pillow pillow-heif
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow library not found.")
    print("Install it with: pip install Pillow")
    sys.exit(1)

# Try to import HEIC support (optional but recommended)
HEIC_SUPPORTED = False
try:
    import pillow_heif
    pillow_heif.register_heif_opener()  # Register HEIC/HEIF with Pillow
    HEIC_SUPPORTED = True
except ImportError:
    pass  # HEIC won't be processed, but script still works for other formats


# Supported image extensions
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP'}
HEIC_EXTENSIONS = {'.heic', '.heif', '.HEIC', '.HEIF'}


def get_file_size_str(size_bytes):
    """Convert bytes to human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"


def compress_image(filepath, quality=80, max_width=1920, verbose=False):
    """
    Compress a single image file in-place.
    
    Returns:
        tuple: (original_size, new_size, was_resized)
    """
    original_size = os.path.getsize(filepath)
    
    try:
        with Image.open(filepath) as img:
            original_format = img.format
            original_mode = img.mode
            original_dimensions = img.size
            
            # Handle EXIF orientation
            try:
                from PIL import ExifTags
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation] == 'Orientation':
                        break
                exif = img._getexif()
                if exif is not None:
                    orientation_value = exif.get(orientation)
                    if orientation_value == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation_value == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation_value == 8:
                        img = img.rotate(90, expand=True)
            except (AttributeError, KeyError, IndexError):
                pass
            
            # Resize if wider than max_width
            was_resized = False
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.LANCZOS)
                was_resized = True
            
            # Determine save parameters based on format
            ext = Path(filepath).suffix.lower()
            
            if ext in {'.jpg', '.jpeg'}:
                # Convert RGBA to RGB for JPEG
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(filepath, 'JPEG', quality=quality, optimize=True)
                
            elif ext == '.png':
                # For PNG, use optimize and optionally reduce colors
                img.save(filepath, 'PNG', optimize=True)
                
            elif ext == '.webp':
                img.save(filepath, 'WEBP', quality=quality, optimize=True)
            
            elif ext in {'.heic', '.heif'}:
                # Convert HEIC/HEIF to JPEG (browsers don't support HEIC)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                # Save as .jpg with same base name
                new_filepath = str(Path(filepath).with_suffix('.jpg'))
                img.save(new_filepath, 'JPEG', quality=quality, optimize=True)
                # Delete original HEIC file
                os.remove(filepath)
                filepath = new_filepath  # Update for size calculation
                if verbose:
                    print(f"  Converted to: {new_filepath}")
            
            new_size = os.path.getsize(filepath)
            
            if verbose:
                reduction = ((original_size - new_size) / original_size) * 100 if original_size > 0 else 0
                resize_info = f" (resized from {original_dimensions[0]}x{original_dimensions[1]})" if was_resized else ""
                print(f"  {get_file_size_str(original_size)} → {get_file_size_str(new_size)} ({reduction:.1f}% reduction){resize_info}")
            
            return original_size, new_size, was_resized
            
    except Exception as e:
        print(f"  Error: {e}")
        return original_size, original_size, False


def find_images(directory):
    """Recursively find all supported image files."""
    # Combine base extensions with HEIC if supported
    valid_extensions = SUPPORTED_EXTENSIONS.copy()
    if HEIC_SUPPORTED:
        valid_extensions.update(HEIC_EXTENSIONS)
    
    images = []
    for root, dirs, files in os.walk(directory):
        for filename in files:
            if Path(filename).suffix in valid_extensions:
                images.append(os.path.join(root, filename))
    return sorted(images)


def main():
    parser = argparse.ArgumentParser(
        description='Compress images in the images/ folder while preserving paths and names.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python compress_images.py                    # Compress with defaults
    python compress_images.py --quality 70       # Higher compression
    python compress_images.py --max-width 1200   # Resize large images
    python compress_images.py --dry-run          # Preview without changes
    python compress_images.py --verbose          # Detailed output
        """
    )
    parser.add_argument('--quality', type=int, default=80,
                        help='JPEG/WebP quality (1-100, default: 80)')
    parser.add_argument('--max-width', type=int, default=1920,
                        help='Maximum width in pixels (default: 1920)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be compressed without actually doing it')
    parser.add_argument('--verbose', action='store_true',
                        help='Show detailed output for each image')
    parser.add_argument('--images-dir', type=str, default='images',
                        help='Path to images directory (default: images)')
    
    args = parser.parse_args()
    
    # Validate quality
    if not 1 <= args.quality <= 100:
        print("Error: Quality must be between 1 and 100")
        sys.exit(1)
    
    # Find images directory
    images_dir = args.images_dir
    if not os.path.isdir(images_dir):
        print(f"Error: Images directory '{images_dir}' not found.")
        print("Make sure you're running this script from your website root directory.")
        sys.exit(1)
    
    # Find all images
    images = find_images(images_dir)
    
    if not images:
        print(f"No supported images found in '{images_dir}/'")
        all_formats = SUPPORTED_EXTENSIONS.copy()
        if HEIC_SUPPORTED:
            all_formats.update(HEIC_EXTENSIONS)
        print(f"Supported formats: {', '.join(sorted(all_formats))}")
        if not HEIC_SUPPORTED:
            print("(HEIC support available with: pip install pillow-heif)")
        sys.exit(0)
    
    print(f"\n{'='*60}")
    print(f"Image Compression Script")
    print(f"{'='*60}")
    print(f"Directory:  {os.path.abspath(images_dir)}")
    print(f"Quality:    {args.quality}")
    print(f"Max width:  {args.max_width}px")
    print(f"Images:     {len(images)} found")
    print(f"HEIC:       {'enabled' if HEIC_SUPPORTED else 'disabled (pip install pillow-heif)'}")
    print(f"Mode:       {'DRY RUN (no changes)' if args.dry_run else 'COMPRESS'}")
    print(f"{'='*60}\n")
    
    if args.dry_run:
        print("Images that would be compressed:")
        total_size = 0
        for img_path in images:
            size = os.path.getsize(img_path)
            total_size += size
            print(f"  {img_path} ({get_file_size_str(size)})")
        print(f"\nTotal current size: {get_file_size_str(total_size)}")
        print("\nRun without --dry-run to compress these images.")
        return
    
    # Compress images
    total_original = 0
    total_new = 0
    resized_count = 0
    error_count = 0
    
    for i, img_path in enumerate(images, 1):
        print(f"[{i}/{len(images)}] {img_path}")
        
        try:
            orig, new, was_resized = compress_image(
                img_path, 
                quality=args.quality, 
                max_width=args.max_width,
                verbose=args.verbose
            )
            total_original += orig
            total_new += new
            if was_resized:
                resized_count += 1
        except Exception as e:
            print(f"  Failed: {e}")
            error_count += 1
    
    # Print summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Images processed:  {len(images) - error_count}/{len(images)}")
    print(f"Images resized:    {resized_count}")
    print(f"Original size:     {get_file_size_str(total_original)}")
    print(f"Compressed size:   {get_file_size_str(total_new)}")
    
    if total_original > 0:
        reduction = ((total_original - total_new) / total_original) * 100
        saved = total_original - total_new
        print(f"Space saved:       {get_file_size_str(saved)} ({reduction:.1f}%)")
    
    if error_count > 0:
        print(f"Errors:            {error_count}")
    
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()

    ##use --images-dir to specify what directory