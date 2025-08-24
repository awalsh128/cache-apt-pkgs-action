package cache

import (
	"testing"

	"awalsh128.com/cache-apt-pkgs-action/internal/pkgs"
)

func TestKey_PlainText(t *testing.T) {
	tests := []struct {
		name     string
		key      Key
		expected string
	}{
		{
			name: "Empty key",
			key: Key{
				Packages:      pkgs.NewPackages(),
				Version:       "",
				GlobalVersion: "",
				OsArch:        "",
			},
			expected: "Packages: '', Version: '', GlobalVersion: '', OsArch: ''",
		},
		{
			name: "Single package",
			key: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			expected: "Packages: 'xdot=1.3-1', Version: 'test', GlobalVersion: 'v2', OsArch: 'amd64'",
		},
		{
			name: "Multiple packages",
			key: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1", "rolldice=1.16-1build3"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			expected: "Packages: 'xdot=1.3-1,rolldice=1.16-1build3', Version: 'test', GlobalVersion: 'v2', OsArch: 'amd64'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.key.PlainText()
			if result != tt.expected {
				t.Errorf("PlainText() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestKey_Hash(t *testing.T) {
	tests := []struct {
		name     string
		key1     Key
		key2     Key
		wantSame bool
	}{
		{
			name: "Same keys hash to same value",
			key1: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			wantSame: true,
		},
		{
			name: "Different packages hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"rolldice=1.16-1build3"}),
				Version:       "test",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			wantSame: false,
		},
		{
			name: "Different versions hash to different values",
			key1: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test1",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			key2: Key{
				Packages:      pkgs.NewPackagesFromSlice([]string{"xdot=1.3-1"}),
				Version:       "test2",
				GlobalVersion: "v2",
				OsArch:        "amd64",
			},
			wantSame: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash1 := tt.key1.Hash()
			hash2 := tt.key2.Hash()
			if (hash1 == hash2) != tt.wantSame {
				t.Errorf("Hash equality = %v, want %v", hash1 == hash2, tt.wantSame)
			}
		})
	}
}
