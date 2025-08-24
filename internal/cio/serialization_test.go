package cio

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "json-write-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	type testStruct struct {
		Name  string
		Value int
	}

	tests := []struct {
		name     string
		data     interface{}
		wantErr  bool
		validate func([]byte) bool
	}{
		{
			name: "Write simple struct",
			data: testStruct{
				Name:  "test",
				Value: 42,
			},
			wantErr: false,
			validate: func(data []byte) bool {
				return string(data) == `{"Name":"test","Value":42}`+"\n"
			},
		},
		{
			name:    "Write nil",
			data:    nil,
			wantErr: false,
			validate: func(data []byte) bool {
				return string(data) == "null\n"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filePath := filepath.Join(tmpDir, tt.name+".json")

			err := WriteJSON(filePath, tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("WriteJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if err == nil {
				// Read the file back
				data, err := os.ReadFile(filePath)
				if err != nil {
					t.Fatalf("Failed to read test file: %v", err)
				}

				// Validate content
				if !tt.validate(data) {
					t.Errorf("WriteJSON() wrote incorrect data: %s", string(data))
				}
			}
		})
	}
}

func TestReadJSON(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "json-read-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	type testStruct struct {
		Name  string
		Value int
	}

	tests := []struct {
		name    string
		content string
		want    testStruct
		wantErr bool
	}{
		{
			name:    "Read valid JSON",
			content: `{"Name":"test","Value":42}`,
			want: testStruct{
				Name:  "test",
				Value: 42,
			},
			wantErr: false,
		},
		{
			name:    "Read invalid JSON",
			content: `{"Name":"test","Value":}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filePath := filepath.Join(tmpDir, tt.name+".json")

			// Create test file
			err := os.WriteFile(filePath, []byte(tt.content), 0644)
			if err != nil {
				t.Fatalf("Failed to create test file: %v", err)
			}

			var got testStruct
			err = ReadJSON(filePath, &got)
			if (err != nil) != tt.wantErr {
				t.Errorf("ReadJSON() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && got != tt.want {
				t.Errorf("ReadJSON() = %v, want %v", got, tt.want)
			}
		})
	}
}
