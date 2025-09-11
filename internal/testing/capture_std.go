// Package testing provides utilities for testing, including capturing standard output and error.
package testing

import (
	"io"
	"os"
)

// CaptureStd captures stdout and stderr output during the execution of a function.
// It temporarily redirects the standard streams, executes the provided function,
// and returns the captured output as strings. The original streams are restored
// after execution, even if the function panics.
//
// Example:
//
//	stdout, stderr := CaptureStd(func() {
//	    fmt.Println("captured")
//	    fmt.Fprintf(os.Stderr, "error")
//	})
func CaptureStd(fn func()) (stdout, stderr string) {
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	rOut, wOut, _ := os.Pipe()
	rErr, wErr, _ := os.Pipe()
	os.Stdout = wOut
	os.Stderr = wErr

	done := make(chan struct{})
	go func() {
		bufOut, _ := io.ReadAll(rOut)
		bufErr, _ := io.ReadAll(rErr)
		stdout, stderr = string(bufOut), string(bufErr)
		close(done)
	}()

	fn()
	wOut.Close()
	wErr.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr
	<-done
	return
}
