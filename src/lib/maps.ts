
export function extractCoordsFromGoogleMapsLink(url: string): {lat: number, lng: number} | null {
  if (!url) return null;
  
  // Try raw coordinates format "lat, lng" or "lat,lng"
  const rawMatch = url.match(/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/);
  if (rawMatch) {
    const [lat, lng] = url.split(',').map(s => parseFloat(s.trim()));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Try @lat,lng format
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  
  // Try !3dlat!4dlng format
  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
  }

  // Try /place/NAME/lat,lng format (without @)
  const placeMatch = url.match(/\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) {
    return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  }

  // Try /dir/lat,lng format
  const dirMatch = url.match(/\/dir\/[^/]*\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (dirMatch) {
    return { lat: parseFloat(dirMatch[1]), lng: parseFloat(dirMatch[2]) };
  }

  // Try generic lat,lng in path /.../-3.896677,-38.384261/...
  const pathMatch = url.match(/\/(-?\d+\.\d+),(-?\d+\.\d+)(?:\/|,|$)/);
  if (pathMatch) {
    // Basic validation to avoid matching something like "version/1.2,3.4"
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Try q=lat,lng or query=lat,lng or ll=lat,lng or cbll=lat,lng
  const queryMatch = url.match(/[?&](?:q|query|ll|cbll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  return null;
}
