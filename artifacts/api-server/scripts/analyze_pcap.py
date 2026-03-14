import sys
import json
from scapy.all import rdpcap, IP

def analyze(file_path):
    packets = rdpcap(file_path)
    data = []
    prev_time = None

    for p in packets:
        if IP in p:
            current_time = float(p.time)
            delta = 0.0 if prev_time is None else round(current_time - prev_time, 6)
            prev_time = current_time

            protocol = p[IP].proto
            ttl = p[IP].ttl
            size = len(p)
            src = p[IP].src
            dst = p[IP].dst

            data.append({
                "src_ip": src,
                "dst_ip": dst,
                "packet_size": size,
                "ttl": ttl,
                "protocol": protocol,
                "time_delta": delta
            })

    return data

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
