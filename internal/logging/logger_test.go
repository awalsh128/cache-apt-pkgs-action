package logging

import (
	"bytes"
	"os"
	"regexp"
	"testing"
)

func TestDebug(t *testing.T) {
	tests := []struct {
		name           string
		message        string
		args           []any
		enabled        bool
		expectedLogged bool
	}{
		{
			name:           "Debug enabled",
			message:        "test message",
			args:           []any{},
			enabled:        true,
			expectedLogged: true,
		},
		{
			name:           "Debug disabled",
			message:        "test message",
			args:           []any{},
			enabled:        false,
			expectedLogged: false,
		},
		{
			name:           "Debug with formatting",
			message:        "test %s %d",
			args:           []any{"message", 42},
			enabled:        true,
			expectedLogged: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			SetOutput(&buf)
			defer InitDefault()

			// Set the debug enabled state for this test
			originalEnabled := DebugEnabled
			DebugEnabled = tt.enabled
			defer func() { DebugEnabled = originalEnabled }()

			Debug(tt.message, tt.args...)

			hasOutput := buf.Len() > 0
			if hasOutput != tt.expectedLogged {
				t.Errorf("Debug() logged = %v, expected %v", hasOutput, tt.expectedLogged)
			}
		})
	}
}

func TestDebugLazy(t *testing.T) {
	var evaluated bool
	messageFunc := func() string {
		evaluated = true
		return "test message"
	}

	tests := []struct {
		name             string
		messageFunc      func() string
		enabled          bool
		expectedLogged   bool
		expectedEvaluate bool
	}{
		{
			name:             "DebugLazy enabled",
			messageFunc:      messageFunc,
			enabled:          true,
			expectedLogged:   true,
			expectedEvaluate: true,
		},
		{
			name:             "DebugLazy disabled",
			messageFunc:      messageFunc,
			enabled:          false,
			expectedLogged:   false,
			expectedEvaluate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			SetOutput(&buf)
			defer InitDefault()
			evaluated = false
			DebugEnabled = tt.enabled

			DebugLazy(tt.messageFunc)

			hasOutput := buf.Len() > 0
			if hasOutput != tt.expectedLogged {
				t.Errorf("DebugLazy() logged = %v, expected %v", hasOutput, tt.expectedLogged)
			}
			if evaluated != tt.expectedEvaluate {
				t.Errorf("DebugLazy() evaluated = %v, expected %v", evaluated, tt.expectedEvaluate)
			}
		})
	}
}

func TestInfo(t *testing.T) {
	tests := []struct {
		name    string
		message string
		args    []any
	}{
		{
			name:    "Simple message",
			message: "test message",
			args:    []any{},
		},
		{
			name:    "Formatted message",
			message: "test %s %d",
			args:    []any{"message", 42},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			SetOutput(&buf)
			defer InitDefault()

			Info(tt.message, tt.args...)

			if buf.Len() == 0 {
				t.Error("Info() didn't log anything")
			}
		})
	}
}

func TestInit(t *testing.T) {
	// Save original stderr and cleanup function
	origStderr := os.Stderr
	defer func() {
		os.Stderr = origStderr
	}()

	// Set to base state before test setup since logger is static
	InitDefault()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("Failed to create pipe: %v", err)
	}
	os.Stderr = w

	// Arrange
	Init(false)
	message := "test message after Init"

	// Act
	Info(message)

	// Close write end of pipe
	if err := w.Close(); err != nil {
		t.Errorf("Failed to close pipe writer: %v", err)
	}

	// Read the output
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(r); err != nil {
		t.Errorf("Failed to read from pipe: %v", err)
	}
	if err := r.Close(); err != nil {
		t.Errorf("Failed to close pipe reader: %v", err)
	}

	// Assert
	// Check that the output contains our message (ignoring timestamp)
	actual := buf.String()
	matched := regexp.MustCompile(`^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2} test message after Init\n$`).
		MatchString(actual)
	if !matched {
		t.Errorf("Expected output to regex match %q, but got %q", message, actual)
	}
}
