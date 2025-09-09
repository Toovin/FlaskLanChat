import os
from pathlib import Path

try:
    from colorama import init, Fore, Style

    init()  # Initialize Colorama for Windows ANSI support
    COLORAMA_AVAILABLE = True
except ImportError:
    COLORAMA_AVAILABLE = False
    print("Colorama not installed. Falling back to plain icons. Install with: pip install colorama")

# 🔑 GROUPED ICON SYSTEM
GROUPS = {
    "python": {
        "base_emoji": "🐍",
        "extensions": [".py", ".pyc", ".pyo", ".pyd"],
        "overrides": {".py": "🐍"}
    },
    "web": {
        "base_emoji": "🌐",
        "extensions": [".html", ".css", ".js", ".jsx", ".ts", ".tsx"],
        "overrides": {".js": "🌐"}
    },
    "documents": {
        "base_emoji": "📄",
        "extensions": [".txt", ".md", ".rst", ".log"],
        "overrides": {}
    },
    "data": {
        "base_emoji": "📊",
        "extensions": [".json", ".csv", ".yaml", ".toml", ".xml", ".sql"],
        "overrides": {}
    },
    "images": {
        "base_emoji": "🖼️",
        "extensions": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
        "overrides": {}
    },
    "scripts": {
        "base_emoji": "💻",
        "extensions": [".sh", ".bat", ".ps1", ".pl", ".rb"],
        "overrides": {}
    },
    "archives": {
        "base_emoji": "📦",
        "extensions": [".zip", ".tar", ".gz", ".7z", ".bz2"],
        "overrides": {}
    }
}

# 🔍 EXTENSION TO GROUP MAPPING
EXT_TO_GROUP = {ext: group for group in GROUPS for ext in GROUPS[group]["extensions"]}

# 🎨 COLOR SYSTEM (RGB tuples for each group)
COLORS = {
    "python": (100, 149, 237),  # Cornflower blue
    "web": (60, 179, 113),  # Sea green
    "documents": (245, 245, 220),  # Beige
    "data": (255, 215, 0),  # Gold
    "images": (186, 85, 211),  # Medium purple
    "scripts": (0, 206, 209),  # Cyan
    "archives": (205, 92, 92),  # Indian red
    "directory": (135, 206, 250),  # Sky blue for folders
    "default": (169, 169, 169),  # Gray for default
    "reset": "\033[0m" if COLORAMA_AVAILABLE else ""
}


def get_colored_icon(item, intensity=1.0):
    """Get mnemonic icon with ANSI color based on group, adjusted by intensity"""
    if item.is_dir():
        group_name = "directory"
        icon = "📂"
    else:
        ext = item.suffix.lower()
        group_name = EXT_TO_GROUP.get(ext, "default")
        icon = GROUPS.get(group_name, {"base_emoji": "📄"})["overrides"].get(ext,
                                                                            GROUPS.get(group_name, {"base_emoji": "📄"})[
                                                                                "base_emoji"])

    if not COLORAMA_AVAILABLE:
        return icon  # Fallback to plain icon if Colorama is unavailable

    # Get base RGB color
    rgb = COLORS.get(group_name, COLORS["default"])

    # Adjust intensity (scale RGB values, clamp to 0-255)
    adjusted_rgb = tuple(min(max(int(c * intensity), 0), 255) for c in rgb)

    # Generate ANSI escape code for 24-bit color
    color_code = f"\033[38;2;{adjusted_rgb[0]};{adjusted_rgb[1]};{adjusted_rgb[2]}m"

    return f"{color_code}{icon}{COLORS['reset']}"


def print_directory_contents(directory_path, file_extensions=None, full_path=False, intensity=1.0,
                             skip_empty_dirs=False):
    """
    Recursively print directory contents with colored mnemonic icons.

    Args:
        directory_path (str or Path): Path to scan
        file_extensions (list of str): Optional extensions to include
        full_path (bool): If True, show full relative paths; else, show item names
        intensity (float): Color intensity (0.0 to 1.0, default 1.0)
        skip_empty_dirs (bool): If True, skip directories with no valid contents
    """
    if file_extensions is None:
        file_extensions = [
            ext for group in GROUPS.values() for ext in group["extensions"]
        ]

    # Validate directory
    directory = Path(directory_path)
    if not directory.exists():
        print(f"Error: Directory '{directory_path}' does not exist.")
        return
    if not directory.is_dir():
        print(f"Error: '{directory_path}' is not a directory.")
        return

    def print_tree(current_path, prefix="", depth=0):
        """Recursive tree printer with colored icons"""
        items = sorted(
            current_path.iterdir(),
            key=lambda x: (not x.is_dir(), x.name.lower())
        )
        valid_items = [
            item for item in items
            if (item.is_dir() or (item.is_file() and item.suffix.lower() in file_extensions))
        ]

        for index, item in enumerate(valid_items):
            is_last = index == len(valid_items) - 1
            connector = "└──" if is_last else "├──"
            indent = prefix + connector
            rel_path = item.relative_to(directory)
            icon = get_colored_icon(item, intensity)
            display_name = rel_path.as_posix() if full_path else rel_path.name
            print(f"{indent} {icon} {display_name}")

            if item.is_dir():
                # Check if directory has valid contents (if skip_empty_dirs is True)
                if skip_empty_dirs:
                    has_valid_contents = any(
                        subitem.is_file() and subitem.suffix.lower() in file_extensions
                        or subitem.is_dir()
                        for subitem in item.iterdir()
                    )
                    if not has_valid_contents:
                        continue
                new_prefix = prefix + ("    " if is_last else "│   ")
                print_tree(item, new_prefix, depth + 1)

    # Start output
    print(f"{get_colored_icon(directory, intensity)} {directory.name}")
    print_tree(directory)


if __name__ == "__main__":
    target_directory = input("Enter directory path to scan (e.g., /home/user/project): ").strip()
    custom_extensions = None  # Use all extensions from GROUPS
    print("\n🔍 Scanning directory and subfolders...")
    print_directory_contents(target_directory, custom_extensions, full_path=False, intensity=1.0, skip_empty_dirs=True)