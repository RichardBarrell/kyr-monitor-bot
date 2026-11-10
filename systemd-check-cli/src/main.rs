use dbus::{arg::RefArg, blocking::Connection};
use std::time::Duration;

mod systemd1;
use crate::systemd1::OrgFreedesktopDBusProperties;

enum ServiceQueryResult {
    Good(ServiceStatus),
    Bad(String),
}
struct ServiceStatus {
    active_state: String,
    sub_state: String,
    active_time: Option<u64>,
}
impl nojson::DisplayJson for ServiceQueryResult {
    fn fmt(&self, f: &mut nojson::JsonFormatter<'_, '_>) -> std::fmt::Result {
        f.object(|f| match self {
            ServiceQueryResult::Good(status) => {
                f.member("activeState", &status.active_state)?;
                f.member("subState", &status.sub_state)?;
                if let Some(time) = status.active_time {
                    f.member("activeTime", time)?;
                }
                Ok(())
            }
            ServiceQueryResult::Bad(message) => f.member("error", message),
        })
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::new_system()?;
    let proxy = conn.with_proxy(
        "org.freedesktop.systemd1",
        "/org/freedesktop/systemd1",
        Duration::from_millis(5000),
    );
    let now_seconds: u64 = nix::time::clock_gettime(nix::time::ClockId::CLOCK_MONOTONIC)?
        .tv_sec()
        .try_into()?;

    fn print_status_for_unit(
        conn: &Connection,
        proxy: &dbus::blocking::Proxy<'_, &Connection>,
        unit_name: &str,
        now_seconds: u64,
    ) -> Result<ServiceStatus, Box<dyn std::error::Error>> {
        let path = proxy
            .method_call("org.freedesktop.systemd1.Manager", "GetUnit", (unit_name,))
            .map(|p: (dbus::Path<'static>,)| p.0)?;
        let unit_proxy = conn.with_proxy(
            "org.freedesktop.systemd1",
            path,
            Duration::from_millis(5000),
        );
        let unit_props = unit_proxy.get_all("org.freedesktop.systemd1.Unit")?;
        let active_state = unit_props
            .get("ActiveState")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "bad or missing ActiveState property")?
            .to_owned();
        let sub_state = unit_props
            .get("SubState")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "bad or missing SubState property")?
            .to_owned();
        let active_enter_us = unit_props
            .get("ActiveEnterTimestampMonotonic")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| "bad or missing ActiveEnterTimestampMonotonic property")?
            .to_owned();
        let active_time = if active_enter_us != 0 && active_state == "active" {
            Some(now_seconds - (active_enter_us / 1_000_000))
        } else {
            None
        };
        Ok(ServiceStatus {
            active_state,
            sub_state,
            active_time,
        })
    }

    let mut results = Vec::<(String, ServiceQueryResult)>::new();
    for unit_name in std::env::args().skip(1) {
        let unit_result = print_status_for_unit(&conn, &proxy, &unit_name, now_seconds);
        match unit_result {
            Ok(status) => {
                results.push((unit_name, ServiceQueryResult::Good(status)));
            }
            Err(err) => {
                let message = format!("{}", err);
                results.push((unit_name, ServiceQueryResult::Bad(message)));
            }
        }
    }

    let pretty = nojson::json(|f| {
        f.set_indent_size(4);
        f.set_spacing(true);
        f.object(|f| {
            for (name, result) in &results {
                f.member(name, result)?;
            }
            Ok(())
        })
    });
    println!("{}", pretty);

    Ok(())
}
