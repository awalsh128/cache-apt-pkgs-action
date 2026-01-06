package cio

import (
	"bufio"
	"context"
	"io"
	"os"
	"strings"
	"sync"
)

// PrintScanner scans stdout and stderr for local print prefixes while allowing
// normal terminal output to continue. This is useful for detecting and handling local
// print statements in a non-blocking way.
type PrintScanner struct {
	ctx        context.Context
	cancel     context.CancelFunc
	origStdout *os.File
	origStderr *os.File
	rOut, wOut *os.File
	rErr, wErr *os.File
	prefix     string
	matches    []string
	mu         sync.Mutex
	wg         sync.WaitGroup
}

// NewPrintScanner creates a new scanner that monitors stdout and stderr for the given prefix.
// It sets up pipe redirection while maintaining terminal output.
func NewPrintScanner(prefix string) (*PrintScanner, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// Save original file descriptors
	origStdout := os.Stdout
	origStderr := os.Stderr

	// Create pipes for stdout and stderr
	rOut, wOut, err := os.Pipe()
	if err != nil {
		cancel()
		return nil, err
	}

	rErr, wErr, err := os.Pipe()
	if err != nil {
		cancel()
		rOut.Close()
		wOut.Close()
		return nil, err
	}

	scanner := &PrintScanner{
		ctx:        ctx,
		cancel:     cancel,
		origStdout: origStdout,
		origStderr: origStderr,
		rOut:       rOut,
		wOut:       wOut,
		rErr:       rErr,
		wErr:       wErr,
		prefix:     prefix,
	}

	return scanner, nil
}

// Start begins monitoring stdout and stderr in the background.
// It sets up the necessary pipes and starts goroutines for scanning.
func (s *PrintScanner) Start() error {
	// Redirect stdout and stderr
	os.Stdout = s.wOut
	os.Stderr = s.wErr

	// Start monitoring stdout
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.monitorStream(s.rOut, s.origStdout)
	}()

	// Start monitoring stderr
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.monitorStream(s.rErr, s.origStderr)
	}()

	return nil
}

// Stop terminates the monitoring and restores original stdout/stderr.
// It waits for all goroutines to complete before returning.
func (s *PrintScanner) Stop() error {
	s.cancel()

	// Restore original stdout and stderr
	os.Stdout = s.origStdout
	os.Stderr = s.origStderr

	// Close write ends of pipes
	s.wOut.Close()
	s.wErr.Close()

	// Wait for monitoring goroutines to finish
	s.wg.Wait()

	// Close read ends of pipes
	s.rOut.Close()
	s.rErr.Close()

	return nil
}

// GetMatches returns all captured lines that matched the prefix.
// It's safe to call this method concurrently.
func (s *PrintScanner) GetMatches() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]string, len(s.matches))
	copy(result, s.matches)
	return result
}

// monitorStream reads from the pipe and writes to the original file descriptor
// while scanning for the prefix. This is run in a goroutine for each stream.
func (s *PrintScanner) monitorStream(r *os.File, orig *os.File) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()

		// Write to original file descriptor for normal output
		io.WriteString(orig, line+"\n")

		// Check for prefix and store match
		if strings.HasPrefix(line, s.prefix) {
			s.mu.Lock()
			s.matches = append(s.matches, line)
			s.mu.Unlock()
		}

		// Check if we should stop
		select {
		case <-s.ctx.Done():
			return
		default:
		}
	}
}
