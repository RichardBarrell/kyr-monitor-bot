# systemd-check-cli

This is a command line tool that queries systemd via DBus and prints service statuses in JSON format.

Run it like:

```
systemd-check-cli kyrsoftware-dbench.service kyrsoftware-dbench-delete-unused-cvs.timer service-which-does-not-exist.service
```

and it will output JSON like:

```json
{
    "kyrsoftware-dbench.service": {
        "activeState": "active",
        "subState": "running",
        "activeTime": 48471
    },
    "kyrsoftware-dbench-delete-unused-cvs.timer": {
        "activeState": "active",
        "subState": "waiting",
        "activeTime": 225313
    },
    "service-which-does-not-exist.service": {
        "error": "Unit service-which-does-not-exist.service not loaded."
    }
}
```

## Dependencies

Get a Ubuntu VM. Install the headers for libdbus:

```sh
sudo apt install libdbus-1-dev pkg-config
```

Install Rust with [rustup](https://rustup.rs/)

## Compile it

```sh
cargo build --release
```

The output executable will be `./target/release/systemd-check-cli`