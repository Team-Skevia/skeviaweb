from pathlib import Path
import shutil


repository_root = Path(__file__).resolve().parent.parent
output_directory = repository_root / "Website" / "build"

# Only these reviewed files may enter the public deployment.
public_files = (
    "CNAME",
    "Website/index.html",
    "Website/anvil.html",
    "Website/ave.html",
    "Website/tekka.html",
    "Website/contact.html",
    "Website/styles.css",
    "Website/script.js",
    "Website/ripple.js",
    "Assets/Icons/apple-touch-icon.png",
    "Assets/Icons/favicon.ico",
    "Assets/Icons/favicon.png",
    "Assets/Logos/mark.png",
    "Assets/Logos/logo-green-on-black.png",
    "Assets/Logos/logo-green-on-white.png",
)


def build_site():
    for relative_path in public_files:
        source = repository_root / relative_path
        if not source.is_file() or not source.resolve().is_relative_to(repository_root):
            raise ValueError(f"Missing or external public file: {relative_path}")

    if output_directory.is_symlink():
        raise ValueError("The build directory must not be a symbolic link.")
    if output_directory.exists():
        shutil.rmtree(output_directory)
    output_directory.mkdir(parents=True)

    for relative_path in public_files:
        public_path = Path(relative_path).name if relative_path.startswith("Website/") and relative_path.endswith(".html") else relative_path
        destination = output_directory / public_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        source = repository_root / relative_path
        if public_path.endswith(".html"):
            content = source.read_bytes()
            if content.startswith(b"---\n"):
                front_matter, separator, content = content[4:].partition(b"\n---\n")
                if not separator:
                    raise ValueError(f"{relative_path} front matter is missing its closing delimiter.")
            destination.write_bytes(content)
        else:
            shutil.copyfile(source, destination)

    print(f"Built {len(public_files)} public files in Website/build/.")


if __name__ == "__main__":
    build_site()
