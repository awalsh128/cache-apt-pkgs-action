package cache

import (
	"archive/tar"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	content1 = "content 1"
	content2 = "content 2"
)

func setupFiles(t *testing.T) (string, func()) {
	assert := assert.New(t)

	// Create temporary directory
	tempDir := filepath.Join(os.TempDir(), "tar_files")
	err := os.MkdirAll(tempDir, 0755)
	assert.NoError(err, "Failed to create temp dir")

	// Create test files
	file1Path := filepath.Join(tempDir, "file1.txt")
	err = os.WriteFile(file1Path, []byte(content1), 0644)
	assert.NoError(err, "Failed to create file 1")

	file2Path := filepath.Join(tempDir, "file2.txt")
	err = os.WriteFile(file2Path, []byte(content2), 0644)
	assert.NoError(err, "Failed to create file 2")

	subDirPath := filepath.Join(tempDir, "subdir")
	err = os.MkdirAll(subDirPath, 0755)
	assert.NoError(err, "Failed to create subdir")

	// Create a file in subdir
	file3Path := filepath.Join(subDirPath, "file3.txt")
	err = os.WriteFile(file3Path, []byte(content2), 0644) // Same content as file2
	assert.NoError(err, "Failed to create file 3")

	// Create symlinks - one relative, one absolute
	symlinkPath := filepath.Join(tempDir, "link.txt")
	err = os.Symlink("file1.txt", symlinkPath)
	assert.NoError(err, "Failed to create relative symlink")

	absSymlinkPath := filepath.Join(tempDir, "abs_link.txt")
	err = os.Symlink(file3Path, absSymlinkPath)
	assert.NoError(err, "Failed to create absolute symlink")

	cleanup := func() {
		os.RemoveAll(tempDir)
	}

	return tempDir, cleanup
}

func TestTarFiles(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Setup files
	sourceDir, cleanup := setupFiles(t)
	defer cleanup()

	// Create destination for the archive
	destPath := filepath.Join(sourceDir, "test.tar")

	// Files to archive (absolute paths)
	files := []string{
		filepath.Join(sourceDir, "file1.txt"),
		filepath.Join(sourceDir, "file2.txt"),
		filepath.Join(sourceDir, "link.txt"),
		filepath.Join(sourceDir, "abs_link.txt"),
	}

	// Create the archive
	err := TarFiles(destPath, files)
	require.NoError(err, "TarFiles should succeed")

	// Verify the archive exists
	_, err = os.Stat(destPath)
	assert.NoError(err, "Archive file should exist") // Open and verify the archive contents
	file, err := os.Open(destPath)
	require.NoError(err, "Should be able to open archive")
	defer file.Close()

	// Create tar reader
	tr := tar.NewReader(file)

	// Map to track found files
	foundFiles := make(map[string]bool)
	foundContent := make(map[string]string)
	foundLinks := make(map[string]string)

	// Read all files from the archive
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		require.NoError(err, "Should be able to read tar header")

		// When checking files, reconstruct the absolute path
		absPath := "/" + header.Name
		foundFiles[absPath] = true

		if header.Typeflag == tar.TypeSymlink {
			foundLinks[filepath.Base(header.Name)] = header.Linkname
			continue
		}

		if header.Typeflag == tar.TypeReg {
			content, err := io.ReadAll(tr)
			require.NoError(err, "Should be able to read file content")
			foundContent[filepath.Base(header.Name)] = string(content)
		}
	}

	// Verify all files were archived
	for _, f := range files {
		assert.True(foundFiles[f], "Archive should contain %s", f)
	}

	// Verify symlink targets are present
	file3AbsPath := filepath.Join(sourceDir, "subdir/file3.txt")
	assert.True(foundFiles[file3AbsPath], "Archive should contain symlink target %s", file3AbsPath)

	// Get base name of file3 for content check
	file3Base := filepath.Base(file3AbsPath)

	// Verify file contents
	assert.Equal(content1, foundContent["file1.txt"], "file1.txt should have correct content")
	assert.Equal(content2, foundContent["file2.txt"], "file2.txt should have correct content")
	assert.Equal(content2, foundContent[file3Base], "file3.txt should have correct content")

	// Verify symlinks
	assert.Equal("file1.txt", foundLinks["link.txt"], "link.txt should point to file1.txt")
	assert.Equal(file3AbsPath[1:], foundLinks["abs_link.txt"], "abs_link.txt should point to file3.txt with correct path")
}

func TestTarFilesErrors(t *testing.T) {
	assert := assert.New(t)

	// Setup files
	sourceDir, cleanup := setupFiles(t)
	defer cleanup()

	file1 := filepath.Join(sourceDir, "file1.txt")

	tests := []struct {
		name     string
		destPath string
		files    []string
		wantErr  bool
	}{
		{
			name:     "Empty destination path",
			destPath: "",
			files:    []string{file1},
			wantErr:  true,
		},
		{
			name:     "Empty files list",
			destPath: "test.tar",
			files:    []string{},
			wantErr:  true,
		},
		{
			name:     "Non-existent file",
			destPath: "test.tar",
			files:    []string{filepath.Join(sourceDir, "nonexistent.txt")},
			wantErr:  true,
		},
		{
			name:     "Directory in files list",
			destPath: "test.tar",
			files:    []string{sourceDir},
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := TarFiles(tt.destPath, tt.files)
			if tt.wantErr {
				assert.Error(err, "TarFiles should return error")
			} else {
				assert.NoError(err, "TarFiles should not return error")
			}
		})
	}
}
