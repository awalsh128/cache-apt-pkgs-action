// manifest.go
//
// Description:
//
//	Provides types and functions for managing cache manifests and keys, including serialization,
//	deserialization, and validation of package metadata.
//
// Package: cache
//
// Example usage:
//
//	// Reading a manifest from file
//	manifest, err := cache.Read("/path/to/manifest.json")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Println("Packages:", manifest.InstalledPackages)
//
//	// Writing a manifest to file
//	err = cache.Write("/path/to/manifest.json", manifest)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	// Writing GitHub outputs
//	err = cache.WriteGithubOutputs("/path/to/outputs.txt", manifest)
//	if err != nil {
//	    log.Fatal(err)
//	}
package cache

import (
	"fmt"
	"os"
	"time"

	"awalsh128.com/cache-apt-pkgs-action/internal/cio"
	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

// ManifestPackage represents a cached package and its installed files.
// It combines package metadata with a list of all files installed by the package.
type ManifestPackage struct {
	// Package contains the basic package metadata (name and version)
	Package pkgs.Package
	// Filepaths is a list of all files installed by this package
	Filepaths []string
}

// Manifest represents the complete state of a cached package set.
// It includes metadata about when the cache was created and what packages
// were installed, along with their files.
type Manifest struct {
	// CacheKey uniquely identifies this cache entry
	CacheKey Key
	// LastModified is when this cache entry was created or last updated
	LastModified time.Time
	// InstalledPackages lists all packages in the cache and their files
	InstalledPackages []ManifestPackage
}

// Read loads a manifest from a JSON file and validates its contents.
// Returns an error if the file cannot be read or contains invalid data.
func Read(filepath string) (*Manifest, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open manifest at %s: %w", filepath, err)
	}
	defer file.Close()

	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest at %s: %w", filepath, err)
	}

	manifest := Manifest{}
	if err := cio.FromJSON(content, &manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func Write(filepath string, manifest *Manifest) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create manifest at %s: %w", filepath, err)
	}
	defer file.Close()

	content, err := cio.ToJSON(manifest)
	if err != nil {
		return fmt.Errorf("failed to serialize manifest to %s: %v", filepath, err)
	}
	if _, err := file.Write([]byte(content)); err != nil {
		return fmt.Errorf("failed to write manifest to %s: %v", filepath, err)
	}
	fmt.Printf("Manifest written to %s\n", filepath)
	return nil
}

func WriteGithubOutputs(filepath string, manifest *Manifest) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create GitHub outputs at %s: %w", filepath, err)
	}
	defer file.Close()

	packageList := ""
	for i, pkg := range manifest.InstalledPackages {
		if i > 0 {
			packageList += ","
		}
		packageList += fmt.Sprintf("%s-%s", pkg.Package.Name, pkg.Package.Version)
	}

	outputLine := fmt.Sprintf("package-version-list=%s\n", packageList)
	if _, err := file.WriteString(outputLine); err != nil {
		return fmt.Errorf("failed to write to GitHub outputs file at %s: %v", filepath, err)
	}
	fmt.Printf("GitHub outputs written to %s\n", filepath)
	return nil
}
