//! Minimal smoke-test contract. Pure compute, zero host imports.
//! Proves the full register -> invoke pipeline with our claimed key.
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

wit_bindgen::generate!({
    world: "smoke",
    path: "wit",
});

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::smoke::contracts::Guest for Component {
    fn ping(
        req: exports::z::smoke::contracts::GenericInput,
    ) -> Result<alloc::vec::Vec<u8>, alloc::string::String> {
        let echo_len = req.input.as_ref().map(|v| v.len()).unwrap_or(0);
        let body = alloc::format!("{{\"pong\":true,\"echo_len\":{}}}", echo_len);
        Ok(body.into_bytes())
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);
