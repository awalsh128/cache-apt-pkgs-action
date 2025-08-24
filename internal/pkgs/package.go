package pkgs

import (
	"fmt"
	"strings"
)

// Package represents an APT package with optional version information.
// It follows the APT package specification format of "name" or "name=version".
type Package struct {
	// Name is the package name as known to APT
	Name string
	// Version is the specific version requested, if any
	Version string
}

// NewPackage creates a Package from an APT package specification string.
// The string should be in the format "name" or "name=version".
// Returns an error if the name is empty or if a version separator
// is present but the version is empty.
func NewPackage(aptArgs string) (*Package, error) {
	parts := strings.SplitN(aptArgs, "=", 2)
	if len(parts) == 1 {
		if parts[0] == "" {
			return nil, fmt.Errorf("package name cannot be empty")
		}
		return &Package{Name: parts[0]}, nil
	}
	if parts[0] == "" {
		return nil, fmt.Errorf("package name cannot be empty")
	}
	if parts[1] == "" {
		return nil, fmt.Errorf("package version cannot be empty if specified")
	}
	return &Package{Name: parts[0], Version: parts[1]}, nil
}

// String returns the package specification in APT format.
// If Version is empty, returns just the package name.
// If Version is set, returns "name=version".
func (p Package) String() string {
	if p.Version != "" {
		return fmt.Sprintf("%s=%s", p.Name, p.Version)
	}
	return p.Name
}
