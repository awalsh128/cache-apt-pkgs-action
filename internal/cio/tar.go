// Package cio provides common I/O operations for the application.
package cio

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// validateTarInputs performs basic validation of tar archive inputs.
func validateTarInputs(destPath string, files []string) error {
	if destPath == "" {
		return fmt.Errorf("destination path is required")
	}
	if len(files) == 0 {
		return fmt.Errorf("at least one file is required")
	}
	return nil
}

// createTarWriter creates a new tar archive writer.
// The caller is responsible for closing both the writer and file.
func createTarWriter(destPath string) (*tar.Writer, *os.File, error) {
	// Create parent directories if they don't exist
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return nil, nil, fmt.Errorf("failed to create parent directories: %w", err)
	}

	// Create the tar file
	file, err := os.Create(destPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create tar file: %w", err)
	}

	return tar.NewWriter(file), file, nil
}

// validateFileType checks if the file type is supported for archiving.
func validateFileType(info os.FileInfo, absPath string) error {
	if !info.Mode().IsRegular() && info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("unsupported file type for %s", absPath)
	}
	return nil
}

// addFileToTar adds a single file or symbolic link to the tar archive.
func addFileToTar(tw *tar.Writer, absPath string) error {
	info, err := os.Lstat(absPath)
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}

	if err := validateFileType(info, absPath); err != nil {
		return err
	}

	// Create the tar header
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return fmt.Errorf("failed to create tar header: %w", err)
	}

	// Update the name to use the full path
	header.Name = absPath

	// Write the header
	if err := tw.WriteHeader(header); err != nil {
		return fmt.Errorf("failed to write tar header: %w", err)
	}

	// If it's a symlink, no need to write content
	if info.Mode()&os.ModeSymlink != 0 {
		return nil
	}

	// Open and copy the file content
	file, err := os.Open(absPath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	if _, err := io.Copy(tw, file); err != nil {
		return fmt.Errorf("failed to write file content: %w", err)
	}

	return nil
}

// CreateTar creates a new tar archive containing the specified files.
func CreateTar(destPath string, files []string) error {
	if err := validateTarInputs(destPath, files); err != nil {
		return err
	}

	tw, file, err := createTarWriter(destPath)
	if err != nil {
		return err
	}
	defer file.Close()
	defer tw.Close()

	// Add each file to the archive
	for _, f := range files {
		absPath, err := filepath.Abs(f)
		if err != nil {
			return fmt.Errorf("failed to get absolute path for %s: %w", f, err)
		}

		if err := addFileToTar(tw, absPath); err != nil {
			return fmt.Errorf("failed to add %s to tar: %w", f, err)
		}
	}

	return nil
}
