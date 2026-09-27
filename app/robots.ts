import type { MetadataRoute } from "next"
import { baseUrl } from "@/lib/registry"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    // The `Host` directive takes a host name, not an origin.
    host: new URL(baseUrl()).host,
  }
}
