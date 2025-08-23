package cache

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func MkDir(dir string) error {
	if dir == "" {
		return fmt.Errorf("directory path cannot be empty")
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %v", dir, err)
	}
	return nil
}

func WriteKey(filepath string, key Key) error {
	// Write cache key to file
	if err := os.WriteFile(filepath, []byte(key.Hash()), 0644); err != nil {
		return fmt.Errorf("failed to write cache key to %s: %w", filepath, err)
	}
	return nil
}

// validateTarInputs checks if the input parameters for tar creation are valid
func validateTarInputs(destPath string, files []string) error {
	if destPath == "" {
		return fmt.Errorf("destination path cannot be empty")
	}
	if len(files) == 0 {
		return fmt.Errorf("no files provided")
	}
	return nil
}

// createTarWriter creates a new tar writer for the given destination path
func createTarWriter(destPath string) (*tar.Writer, *os.File, error) {
	// Create parent directory for destination file if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return nil, nil, fmt.Errorf("failed to create parent directory for %s: %w", destPath, err)
	}

	// Create the tar file
	file, err := os.Create(destPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create destination file %s: %w", destPath, err)
	}

	// Create tar writer
	tw := tar.NewWriter(file)
	return tw, file, nil
}

// validateFileType checks if the file is a regular file or symlink
func validateFileType(info os.FileInfo, absPath string) error {
	if !info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("file %s is not a regular file or symlink", absPath)
	}
	return nil
}

// createFileHeader creates a tar header for the given file info
func createFileHeader(info os.FileInfo, absPath string) (*tar.Header, error) {
	header, err := tar.FileInfoHeader(info, "") // Empty link name for now
	if err != nil {
		return nil, fmt.Errorf("failed to create tar header for %s: %w", absPath, err)
	}
	// Use path relative to root for archive
	header.Name = absPath[1:] // Remove leading slash
	return header, nil
}

// writeRegularFile writes a regular file's contents to the tar archive
func writeRegularFile(tw *tar.Writer, absPath string) error {
	srcFile, err := os.Open(absPath)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", absPath, err)
	}
	defer srcFile.Close()

	if _, err := io.Copy(tw, srcFile); err != nil {
		return fmt.Errorf("failed to write %s to archive: %w", absPath, err)
	}
	return nil
}

// getSymlinkTarget gets the absolute path of a symlink target
func getSymlinkTarget(linkTarget, absPath string) string {
	if filepath.IsAbs(linkTarget) {
		return linkTarget
	}
	return filepath.Join(filepath.Dir(absPath), linkTarget)
}

// handleSymlinkTarget handles the target file of a symlink
func handleSymlinkTarget(tw *tar.Writer, targetPath string, header *tar.Header, linkTarget string) error {
	targetInfo, err := os.Stat(targetPath)
	if err != nil || targetInfo.IsDir() {
		return nil // Skip if target doesn't exist or is a directory
	}

	// Create header for target file
	targetHeader, err := tar.FileInfoHeader(targetInfo, "")
	if err != nil {
		return fmt.Errorf("failed to create tar header for symlink target %s: %w", targetPath, err)
	}

	// Store with path relative to root
	targetHeader.Name = targetPath[1:]

	// For absolute symlinks, make the linkname relative to root too
	if filepath.IsAbs(linkTarget) {
		header.Linkname = linkTarget[1:]
	}

	// Write target header and contents
	if err := tw.WriteHeader(targetHeader); err != nil {
		return fmt.Errorf("failed to write tar header for symlink target %s: %w", targetPath, err)
	}

	return writeRegularFile(tw, targetPath)
}

// handleSymlink handles a symlink file and its target
func handleSymlink(tw *tar.Writer, absPath string, header *tar.Header) error {
	// Read the target of the symlink
	linkTarget, err := os.Readlink(absPath)
	if err != nil {
		return fmt.Errorf("failed to read symlink %s: %w", absPath, err)
	}
	header.Linkname = linkTarget

	// Get absolute path of target and handle it
	targetPath := getSymlinkTarget(linkTarget, absPath)
	return handleSymlinkTarget(tw, targetPath, header, linkTarget)
}

// TarFiles creates a tar archive containing the specified files.
// Matches behavior of install_and_cache_pkgs.sh script.
//
// Parameters:
//   - destPath: Path where the tar file should be created
//   - files: List of absolute file paths to include in the archive
//
// The function will:
//   - Archive files relative to root directory (like -C /)
//   - Include only regular files and symlinks
//   - Preserve file permissions and timestamps
//   - Handle special characters in paths
//   - Save symlinks as-is without following them
//
// Returns an error if:
//   - destPath is empty or invalid
//   - Any file in files list is not a regular file or symlink
//   - Permission denied when reading files or writing archive
func TarFiles(destPath string, files []string) error {
	if err := validateTarInputs(destPath, files); err != nil {
		return err
	}

	tw, file, err := createTarWriter(destPath)
	if err != nil {
		return err
	}
	defer file.Close()
	defer tw.Close()

	// Process each file
	for _, absPath := range files {
		// Get file info and validate type
		info, err := os.Lstat(absPath)
		if err != nil {
			return fmt.Errorf("failed to stat %s: %w", absPath, err)
		}
		if err := validateFileType(info, absPath); err != nil {
			return err
		}

		// Create and initialize header
		header, err := createFileHeader(info, absPath)
		if err != nil {
			return err
		}

		// Handle symlinks and their targets
		if info.Mode()&os.ModeSymlink != 0 {
			if err := handleSymlink(tw, absPath, header); err != nil {
				return err
			}
		}

		// Write the file's header
		if err := tw.WriteHeader(header); err != nil {
			return fmt.Errorf("failed to write tar header for %s: %w", absPath, err)
		}

		// Write the file's contents if it's a regular file
		if info.Mode().IsRegular() {
			if err := writeRegularFile(tw, absPath); err != nil {
				return err
			}
		}
	}

	return nil
}
