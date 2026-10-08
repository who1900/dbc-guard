# Pure-JavaScript bigint codec

An independent implementation, not an upstream patched release or a renamed copy of vulnerable native code. Replaces only the four `bigint-buffer` functions used by `@solana/buffer-layout-utils`. There are no dependencies, native addons, install scripts, or dynamic code loading.

Valid unsigned values retain the same fixed-width, endian-aware encoding. Empty buffers decode to zero. Inputs are not mutated. Unlike the old fallback's silent overflow/truncation, negative values and values outside their requested width fail closed. Width is bounded to 1024 bytes; Solana's layouts use 8, 16, 24, and 32. This is a deliberate compatibility limit, not a general-purpose replacement for every possible upstream consumer.

The root override applies this local package to the transitive dependency. Tests cover the installed dependency, byte-level vectors, deterministic round trips, boundaries, real SPL layouts, Anchor TOML parsing, and Solana RPC through the overridden Jayson client. Retain these checks when upgrading the SDK.
