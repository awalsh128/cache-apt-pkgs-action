package pkgs

import (
	"testing"
)

func TestFindInstalledPackages(t *testing.T) {
	tests := []struct {
		name        string
		input       []Package
		wantValid   []Package
		wantInvalid []string
		wantError   bool
	}{
		{
			name:        "empty list",
			input:       []Package{},
			wantValid:   []Package{},
			wantInvalid: []string{},
			wantError:   false,
		},
		// Add more test cases here once we have a way to mock syspkg
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := FindInstalledPackages(tt.input)
			if (err != nil) != tt.wantError {
				t.Errorf("FindInstalledPackages() error = %v, wantError %v", err, tt.wantError)
				return
			}
			if err != nil {
				return
			}

			if len(result.Valid) != len(tt.wantValid) {
				t.Errorf("FindInstalledPackages() valid = %v, want %v", result.Valid, tt.wantValid)
			}

			if len(result.Invalid) != len(tt.wantInvalid) {
				t.Errorf("FindInstalledPackages() invalid = %v, want %v", result.Invalid, tt.wantInvalid)
			}
		})
	}
}

func TestValidatePackages(t *testing.T) {
	tests := []struct {
		name        string
		packageList string
		wantError   bool
	}{
		{
			name:        "empty string",
			packageList: "",
			wantError:   false,
		},
		{
			name:        "single package",
			packageList: "gcc",
			wantError:   false,
		},
		{
			name:        "multiple packages",
			packageList: "gcc,g++,make",
			wantError:   false,
		},
		{
			name:        "package with version",
			packageList: "gcc=4.8.5",
			wantError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidatePackages(tt.packageList)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidatePackages() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

func TestGetInstalledPackages(t *testing.T) {
	tests := []struct {
		name       string
		installLog string
		wantError  bool
	}{
		{
			name:       "empty log",
			installLog: "test_empty.log",
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := GetInstalledPackages(tt.installLog)
			if (err != nil) != tt.wantError {
				t.Errorf("GetInstalledPackages() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}
