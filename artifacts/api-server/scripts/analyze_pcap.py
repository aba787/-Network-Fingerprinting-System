import sys
import json
import math
from collections import defaultdict
from scapy.all import rdpcap, IP


def compute_stats(values):
    if not values:
        return 0.0, 0.0
    n = len(values)
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / n if n > 1 else 0.0
    std = math.sqrt(variance)
    return round(mean, 4), round(std, 4)


def build_fingerprints(packets_by_ip):
    fingerprints = []
    for ip, pkts in packets_by_ip.items():
        sizes = [p["packet_size"] for p in pkts]
        ttls = [p["ttl"] for p in pkts]
        # Use per-device time deltas (already computed per-IP)
        deltas = [p["time_delta"] for p in pkts if p["time_delta"] > 0]
        unique_dsts = len(set(p["dst_ip"] for p in pkts))

        proto_counts = defaultdict(int)
        for p in pkts:
            proto_counts[str(p["protocol"])] += 1
        total = len(pkts)
        proto_dist = {k: round(v / total * 100, 2) for k, v in proto_counts.items()}

        avg_size, std_size = compute_stats(sizes)
        avg_ttl, std_ttl = compute_stats(ttls)
        avg_delta, std_delta = compute_stats(deltas)

        fingerprints.append({
            "ip": ip,
            "packet_count": total,
            "avg_packet_size": avg_size,
            "std_packet_size": std_size,
            "avg_ttl": avg_ttl,
            "std_ttl": std_ttl,
            "avg_time_delta": avg_delta,
            "std_time_delta": std_delta,
            "protocol_distribution": proto_dist,
            "unique_destinations": unique_dsts,
        })

    fingerprints.sort(key=lambda x: x["packet_count"], reverse=True)
    return fingerprints


def analyze(file_path):
    packets = rdpcap(file_path)
    features = []
    packets_by_ip = defaultdict(list)
    # Track previous timestamp per src_ip for accurate per-device time deltas
    prev_time_by_ip = {}

    for p in packets:
        if IP in p:
            current_time = float(p.time)
            src = p[IP].src

            if src in prev_time_by_ip:
                delta = round(current_time - prev_time_by_ip[src], 6)
            else:
                delta = 0.0
            prev_time_by_ip[src] = current_time

            row = {
                "src_ip": src,
                "dst_ip": p[IP].dst,
                "packet_size": len(p),
                "ttl": p[IP].ttl,
                "protocol": p[IP].proto,
                "time_delta": delta,
            }
            features.append(row)
            packets_by_ip[src].append(row)

    fingerprints = build_fingerprints(packets_by_ip)
    return {"features": features, "fingerprints": fingerprints}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    try:
        result = analyze(file_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
