package cio

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Sample test types for JSON serialization
type testStruct struct {
	Name  string
	Value int
}

type nestedTestStruct struct {
	ID       int
	Details  testStruct
	Tags     []string
	Metadata map[string]interface{}
}

const (
	simpleJSON = `{"Name":"test","Value":42}`
	nestedJSON = `{
  "ID": 1,
  "Details": {
    "Name": "detail",
    "Value": 100
  },
  "Tags": [
    "one",
    "two"
  ],
  "Metadata": {
    "version": 1
  }
}`
)

var (
	simpleStruct = testStruct{
		Name:  "test",
		Value: 42,
	}
	nestedStruct = nestedTestStruct{
		ID:      1,
		Details: testStruct{Name: "detail", Value: 100},
		Tags:    []string{"one", "two"},
		Metadata: map[string]interface{}{
			"version": float64(1),
		},
	}
)

func TestFromJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		target  interface{}
		want    interface{}
		wantErr bool
	}{
		{
			name:   "simple struct",
			input:  simpleJSON,
			target: &testStruct{},
			want:   &simpleStruct,
		},
		{
			name:   "nested struct",
			input:  nestedJSON,
			target: &nestedTestStruct{},
			want:   &nestedStruct,
		},
		{
			name:    "invalid json",
			input:   `{"Name":"test","Value":}`,
			target:  &testStruct{},
			wantErr: true,
		},
		{
			name:   "empty object",
			input:  "{}",
			target: &testStruct{},
			want:   &testStruct{},
		},
		{
			name:   "null input",
			input:  "null",
			target: &testStruct{},
			want:   &testStruct{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := FromJSON([]byte(tt.input), tt.target)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.want, tt.target)
		})
	}
}

func TestToJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		want    string
		wantErr bool
	}{
		{
			name:  "simple struct",
			input: simpleStruct,
			want:  simpleJSON,
		},
		{
			name:  "nested struct",
			input: nestedStruct,
			want:  nestedJSON,
		},
		{
			name:  "nil input",
			input: nil,
			want:  "null",
		},
		{
			name:  "empty slice",
			input: []string{},
			want:  "[]",
		},
		{
			name:  "empty struct",
			input: struct{}{},
			want:  "{}",
		},
		{
			name:    "invalid type",
			input:   make(chan int),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ToJSON(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			if tt.input != nil {
				assertValidJSON(t, got)
			}
			assert.JSONEq(t, tt.want, got)
		})
	}
}

// Helper function to verify JSON validity
func assertValidJSON(t *testing.T, data string) {
	t.Helper()
	var unmarshaled interface{}
	err := json.Unmarshal([]byte(data), &unmarshaled)
	assert.NoError(t, err, "produced JSON should be valid")
}
