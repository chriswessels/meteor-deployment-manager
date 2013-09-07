Keyboard-interactive mode.
Insecure option.
Symlink with releases.
find . -maxdepth 1 -type f -printf '%T@ %p\0' | sort -r -z -n | awk 'BEGIN { RS="\0"; ORS="\0"; FS="" } NR > 5 { sub("^[0-9]*(.[0-9]*)? ", ""); print }' | xargs -0 rm -f
