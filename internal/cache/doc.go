// Package cache provides functionality for managing APT package cache keys.
// It handles the creation, serialization, and validation of cache keys that uniquely
// identify sets of packages for caching in GitHub Actions.
//
// Example usage:
//
//	// Create a new cache key
//	key := cache.NewKey(packages, "v1.0", "v2", "amd64")
//
//	// Write the key to files
//	err := key.Write("key.txt", "key.md5")
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	// Read and validate a key
//	plaintext, hash, err := cache.ReadKey("key.txt", "key.md5")
package cache
