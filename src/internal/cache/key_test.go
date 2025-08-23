package cache

import (
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/src/internal/pkgs"
	"github.com/stretchr/testify/assert"
)

const (
	// Package names
	pkg1 = "pkg1"
	pkg2 = "pkg2"

	// Versions
	version1 = "1.0.0"
	version2 = "2.0.0"
	version3 = "3.0.0"

	// Architectures
	archX86 = "amd64"
	archArm = "arm64"
)

func TestKeyHashEmptyKey(t *testing.T) {
	assert := assert.New(t)
	key := &Key{}
	hash := key.Hash()
	assert.NotEmpty(hash, "Hash should not be empty even for empty key")
}

func TestKeyHashWithPackages(t *testing.T) {
	assert := assert.New(t)
	key := &Key{
		Packages: pkgs.Packages{
			pkgs.Package{Name: pkg1},
			pkgs.Package{Name: pkg2},
		},
	}
	hash1 := key.Hash()

	// Same packages in different order should produce same hash
	key2 := &Key{
		Packages: pkgs.Packages{
			pkgs.Package{Name: pkg2},
			pkgs.Package{Name: pkg1},
		},
	}
	hash2 := key2.Hash()

	assert.Equal(hash1, hash2, "Hash should be same for same packages in different order")

	// Test with versions
	key3 := &Key{
		Packages: pkgs.Packages{
			pkgs.Package{Name: pkg1, Version: version2},
			pkgs.Package{Name: pkg1, Version: version1},
			pkgs.Package{Name: pkg2, Version: version1},
		},
	}
	hash3 := key3.Hash()

	key4 := &Key{
		Packages: pkgs.Packages{
			pkgs.Package{Name: pkg2, Version: version1},
			pkgs.Package{Name: pkg1, Version: version1},
			pkgs.Package{Name: pkg1, Version: version2},
		},
	}
	hash4 := key4.Hash()

	assert.Equal(hash3, hash4, "Hash should be same for same packages and versions in different order")
}

func TestKeyHashWithVersion(t *testing.T) {
	assert := assert.New(t)
	key := &Key{
		Packages: pkgs.Packages{pkgs.Package{Name: pkg1}, pkgs.Package{Name: pkg2}},
		Version:  version1,
	}
	hash1 := key.Hash()

	// Same package with different version should produce different hash
	key2 := &Key{
		Packages: pkgs.Packages{pkgs.Package{Name: pkg1}},
		Version:  version2,
	}
	hash2 := key2.Hash()

	assert.NotEqual(hash1, hash2, "Hash should be different for different versions")
}

func TestKeyHashWithGlobalVersion(t *testing.T) {
	assert := assert.New(t)
	key := &Key{
		Packages:      pkgs.Packages{pkgs.Package{Name: pkg1}},
		GlobalVersion: version1,
	}
	hash1 := key.Hash()

	// Same package with different global version should produce different hash
	key2 := &Key{
		Packages:      pkgs.Packages{{Name: pkg1}},
		GlobalVersion: version2,
	}
	hash2 := key2.Hash()

	assert.NotEqual(hash1, hash2, "Hash should be different for different global versions")
}

func TestKeyHashWithOsArch(t *testing.T) {
	assert := assert.New(t)
	key := &Key{
		Packages: pkgs.Packages{{Name: pkg1}},
		OsArch:   archX86,
	}
	hash1 := key.Hash()

	// Same package with different OS architecture should produce different hash
	key2 := &Key{
		Packages: pkgs.Packages{{Name: pkg1}},
		OsArch:   archArm,
	}
	hash2 := key2.Hash()

	assert.NotEqual(hash1, hash2, "Hash should be different for different OS architectures")
}

func TestKeyHashWithAll(t *testing.T) {
	assert := assert.New(t)
	key := &Key{
		Packages:      pkgs.Packages{{Name: pkg1}, {Name: pkg2}},
		Version:       version1,
		GlobalVersion: version2,
		OsArch:        archX86,
	}
	hash1 := key.Hash()

	// Same values in different order should produce same hash
	key2 := &Key{
		Packages:      pkgs.Packages{{Name: pkg2}, {Name: pkg1}},
		Version:       version1,
		GlobalVersion: version2,
		OsArch:        archX86,
	}
	hash2 := key2.Hash()

	assert.Equal(hash1, hash2, "Hash should be same for same values")
}
