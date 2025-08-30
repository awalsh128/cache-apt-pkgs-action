package cache

import (
	"bytes"
	"os"
	"path"
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

const (
	pkg1     = "xdot=1.3-1"
	pkg2     = "rolldice=1.16-1build3"
	version1 = "test1"
	version2 = "test2"
	version  = "test"
	globalV1 = "v1"
	globalV2 = "v2"
	arch1    = "amd64"
	arch2    = "x86"
)

func TestKey_PlainText(t *testing.T) {
	emptyKey := Key{
		Packages:      pkgs.NewPackagesFromStrings(),
		Version:       "",
		GlobalVersion: "",
		OsArch:        "",
	}
	singleKey := Key{
		Packages:      pkgs.NewPackagesFromStrings(pkg1),
		Version:       version,
		GlobalVersion: globalV2,
		OsArch:        arch1,
	}
	multiKey := Key{
		Packages:      pkgs.NewPackagesFromStrings(pkg1, pkg2),
		Version:       version,
		GlobalVersion: globalV2,
		OsArch:        arch1,
	}

	cases := []struct {
		name     string
		key      Key
		expected string
	}{
		{
			name:     "Empty key",
			key:      emptyKey,
			expected: "Packages: '', Version: '', GlobalVersion: '', OsArch: ''",
		},
		{
			name:     "Single package",
			key:      singleKey,
			expected: "Packages: 'xdot=1.3-1', Version: 'test', GlobalVersion: 'v2', OsArch: 'amd64'",
		},
		{
			name:     "Multiple packages",
			key:      multiKey,
			expected: "Packages: 'xdot=1.3-1,rolldice=1.16-1build3', Version: 'test', GlobalVersion: 'v2', OsArch: 'amd64'",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result := c.key.PlainText()
			if result != c.expected {
				t.Errorf("PlainText() = %v, want %v", result, c.expected)
			}
		})
	}
}

func TestKey_Hash(t *testing.T) {
	cases := []struct {
		name     string
		key1     Key
		key2     Key
		wantSame bool
	}{
		{
			name: "Same keys hash to same value",
			key1: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			wantSame: true,
		},
		{
			name: "Different packages hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg2),
				Version:       version,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			wantSame: false,
		},
		{
			name: "Different versions hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version1,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version2,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			wantSame: false,
		},
		{
			name: "Different global versions hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version1,
				GlobalVersion: globalV1,
				OsArch:        arch1,
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version2,
				GlobalVersion: globalV2,
				OsArch:        arch1,
			},
			wantSame: false,
		},
		{
			name: "Different OS arches hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version1,
				GlobalVersion: globalV1,
				OsArch:        arch1,
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromStrings(pkg1),
				Version:       version2,
				GlobalVersion: globalV2,
				OsArch:        arch2,
			},
			wantSame: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			hash1 := c.key1.Hash()
			hash2 := c.key2.Hash()
			if bytes.Equal(hash1, hash2) != c.wantSame {
				t.Errorf("Hash equality = %v, want %v", bytes.Equal(hash1, hash2), c.wantSame)
			}
		})
	}
}

func TestKey_WriteKeyPlaintext_RoundTripsSameValue(t *testing.T) {
	key := Key{
		Packages:      pkgs.NewPackagesFromStrings(pkg1, pkg2),
		Version:       version,
		GlobalVersion: globalV2,
		OsArch:        arch1,
	}
	plaintextPath := path.Join(t.TempDir(), "key.txt")
	ciphertextPath := path.Join(t.TempDir(), "key.md5")
	err := key.Write(plaintextPath, ciphertextPath)
	if err != nil {
		t.Fatalf("Write() failed: %v", err)
	}
	plaintextBytes, err := os.ReadFile(plaintextPath)
	if err != nil {
		t.Fatalf("ReadAll() failed: %v", err)
	}

	plaintext := string(plaintextBytes)
	if plaintext != key.PlainText() {
		t.Errorf("Round trip failed: got %q, want %q", plaintext, key.PlainText())
	}
}

func TestKey_WriteKeyCiphertext_RoundTripsSameValue(t *testing.T) {
	key := Key{
		Packages:      pkgs.NewPackagesFromStrings(pkg1, pkg2),
		Version:       version,
		GlobalVersion: globalV2,
		OsArch:        arch1,
	}
	plaintextPath := path.Join(t.TempDir(), "key.txt")
	ciphertextPath := path.Join(t.TempDir(), "key.md5")
	err := key.Write(plaintextPath, ciphertextPath)
	if err != nil {
		t.Fatalf("Write() failed: %v", err)
	}
	ciphertextBytes, err := os.ReadFile(ciphertextPath)
	if err != nil {
		t.Fatalf("ReadAll() failed: %v", err)
	}
	ciphertext := string(ciphertextBytes)
	if !bytes.Equal(ciphertextBytes, key.Hash()) {
		t.Errorf("Round trip failed: got %q, want %q", ciphertext, key.Hash())
	}
}
