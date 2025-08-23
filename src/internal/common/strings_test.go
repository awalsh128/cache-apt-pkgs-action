package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExecCommand(t *testing.T) {
	oldExecCommand := ExecCommand
	defer func() {
		ExecCommand = oldExecCommand
	}()

	tests := []struct {
		name     string
		command  string
		args     []string
		output   string
		wantErr  bool
		mockFunc func(string, ...string) (string, error)
	}{
		{
			name:    "simple command",
			command: "echo",
			args:    []string{"hello"},
			output:  "hello",
			mockFunc: func(cmd string, args ...string) (string, error) {
				assert.Equal(t, "echo", cmd)
				assert.Equal(t, []string{"hello"}, args)
				return "hello", nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ExecCommand = tt.mockFunc

			got, err := ExecCommand(tt.command, tt.args...)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.output, got)
		})
	}
}

func TestSortAndJoin(t *testing.T) {
	tests := []struct {
		name     string
		strs     []string
		sep      string
		expected string
	}{
		{
			name:     "empty slice",
			strs:     []string{},
			sep:      ",",
			expected: "",
		},
		{
			name:     "single item",
			strs:     []string{"one"},
			sep:      ",",
			expected: "one",
		},
		{
			name:     "multiple items",
			strs:     []string{"c", "a", "b"},
			sep:      ",",
			expected: "a,b,c",
		},
		{
			name:     "custom separator",
			strs:     []string{"c", "a", "b"},
			sep:      "|",
			expected: "a|b|c",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := SortAndJoin(tt.strs, tt.sep)
			assert.Equal(tt.expected, result)
		})
	}
}

func TestSplitAndTrim(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		sep      string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			sep:      ",",
			expected: nil,
		},
		{
			name:     "single item",
			input:    "one",
			sep:      ",",
			expected: []string{"one"},
		},
		{
			name:     "multiple items with whitespace",
			input:    " a , b ,  c ",
			sep:      ",",
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "empty items removed",
			input:    "a,,b, ,c",
			sep:      ",",
			expected: []string{"a", "b", "c"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := SplitAndTrim(tt.input, tt.sep)
			assert.Equal(tt.expected, result)
		})
	}
}

func TestParseKeyValue(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		sep           string
		expectedKey   string
		expectedValue string
	}{
		{
			name:          "no separator",
			input:         "key",
			sep:           "=",
			expectedKey:   "key",
			expectedValue: "",
		},
		{
			name:          "with separator",
			input:         "key=value",
			sep:           "=",
			expectedKey:   "key",
			expectedValue: "value",
		},
		{
			name:          "with whitespace",
			input:         " key = value ",
			sep:           "=",
			expectedKey:   "key",
			expectedValue: "value",
		},
		{
			name:          "custom separator",
			input:         "key:value",
			sep:           ":",
			expectedKey:   "key",
			expectedValue: "value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			key, value := ParseKeyValue(tt.input, tt.sep)
			assert.Equal(tt.expectedKey, key)
			assert.Equal(tt.expectedValue, value)
		})
	}
}

func TestContainsAny(t *testing.T) {
	tests := []struct {
		name       string
		s          string
		substrings []string
		expected   bool
	}{
		{
			name:       "empty string and substrings",
			s:          "",
			substrings: []string{},
			expected:   false,
		},
		{
			name:       "no matches",
			s:          "hello world",
			substrings: []string{"foo", "bar"},
			expected:   false,
		},
		{
			name:       "single match",
			s:          "hello world",
			substrings: []string{"hello", "foo"},
			expected:   true,
		},
		{
			name:       "multiple matches",
			s:          "hello world",
			substrings: []string{"hello", "world"},
			expected:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := ContainsAny(tt.s, tt.substrings...)
			assert.Equal(tt.expected, result)
		})
	}
}

func TestTrimPrefixCaseInsensitive(t *testing.T) {
	tests := []struct {
		name     string
		s        string
		prefix   string
		expected string
	}{
		{
			name:     "exact match",
			s:        "prefixText",
			prefix:   "prefix",
			expected: "Text",
		},
		{
			name:     "case difference",
			s:        "PREFIXText",
			prefix:   "prefix",
			expected: "Text",
		},
		{
			name:     "no match",
			s:        "Text",
			prefix:   "prefix",
			expected: "Text",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := TrimPrefixCaseInsensitive(tt.s, tt.prefix)
			assert.Equal(tt.expected, result)
		})
	}
}

func TestRemoveEmpty(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "empty slice",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "no empty strings",
			input:    []string{"a", "b", "c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "with empty strings",
			input:    []string{"a", "", "b", "", "c"},
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "all empty strings",
			input:    []string{"", "", ""},
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := RemoveEmpty(tt.input)
			assert.Equal(tt.expected, result)
		})
	}
}
