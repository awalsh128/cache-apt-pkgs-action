package cache

import (
	"fmt"
	"sort"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/pkgs"
)

// Key represents a cache key based on package list and version information
type Key struct {
	Packages      pkgs.Packages
	Version       string
	GlobalVersion string
	OsArch        string
}

// Hash returns an MD5 hash of the key's contents, with packages sorted by name and version
func (k *Key) Hash() string {
	// Sort packages in place by Name, then by Version
	sort.Slice(k.Packages, func(i, j int) bool {
		if k.Packages[i].Name != k.Packages[j].Name {
			return k.Packages[i].Name < k.Packages[j].Name
		}
		return k.Packages[i].Version < k.Packages[j].Version
	})

	// Use the sorted packages to generate the hash input
	return fmt.Sprintf("%s @ '%s' '%s' '%s'", k.Packages.String(), k.Version, k.GlobalVersion, k.OsArch)
}
