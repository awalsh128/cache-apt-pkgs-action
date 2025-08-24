package logging

import (
	"bytes"
	"log"
	"os"
	"testing"
)

func TestDebug(t *testing.T) {
	// Capture log output
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	tests := []struct {
		name    string
		message string
		args    []interface{}
		enabled bool
		wantLog bool
	}{
		{
			name:    "Debug enabled",
			message: "test message",
			args:    []interface{}{},
			enabled: true,
			wantLog: true,
		},
		{
			name:    "Debug disabled",
			message: "test message",
			args:    []interface{}{},
			enabled: false,
			wantLog: false,
		},
		{
			name:    "Debug with formatting",
			message: "test %s %d",
			args:    []interface{}{"message", 42},
			enabled: true,
			wantLog: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf.Reset()
			SetDebug(tt.enabled)

			Debug(tt.message, tt.args...)

			hasOutput := buf.Len() > 0
			if hasOutput != tt.wantLog {
				t.Errorf("Debug() logged = %v, want %v", hasOutput, tt.wantLog)
			}
		})
	}
}

func TestDebugLazy(t *testing.T) {
	// Capture log output
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	var evaluated bool
	messageFunc := func() string {
		evaluated = true
		return "test message"
	}

	tests := []struct {
		name         string
		messageFunc  func() string
		enabled      bool
		wantLog      bool
		wantEvaluate bool
	}{
		{
			name:         "DebugLazy enabled",
			messageFunc:  messageFunc,
			enabled:      true,
			wantLog:      true,
			wantEvaluate: true,
		},
		{
			name:         "DebugLazy disabled",
			messageFunc:  messageFunc,
			enabled:      false,
			wantLog:      false,
			wantEvaluate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf.Reset()
			evaluated = false
			SetDebug(tt.enabled)

			DebugLazy(tt.messageFunc)

			hasOutput := buf.Len() > 0
			if hasOutput != tt.wantLog {
				t.Errorf("DebugLazy() logged = %v, want %v", hasOutput, tt.wantLog)
			}
			if evaluated != tt.wantEvaluate {
				t.Errorf("DebugLazy() evaluated = %v, want %v", evaluated, tt.wantEvaluate)
			}
		})
	}
}

func TestInfo(t *testing.T) {
	// Capture log output
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)

	tests := []struct {
		name    string
		message string
		args    []interface{}
	}{
		{
			name:    "Simple message",
			message: "test message",
			args:    []interface{}{},
		},
		{
			name:    "Formatted message",
			message: "test %s %d",
			args:    []interface{}{"message", 42},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf.Reset()

			Info(tt.message, tt.args...)

			if buf.Len() == 0 {
				t.Error("Info() didn't log anything")
			}
		})
	}
}
