import axios from "axios";
import { config } from "../config";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  photos?: Array<{ name?: string }>;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

const DELHI_NCR_CENTER = {
  latitude: 28.6139,
  longitude: 77.209
};

function getDefaultSearchCenter() {
  return {
    latitude: config.googlePlacesDefaultLat ?? DELHI_NCR_CENTER.latitude,
    longitude: config.googlePlacesDefaultLng ?? DELHI_NCR_CENTER.longitude
  };
}

export async function searchDelhiNcrRestaurants(options: {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  minRating?: number;
  limit?: number;
}) {
  if (!config.googlePlacesApiKey) {
    return [];
  }

  const minRating = options.minRating ?? 3;
  const maxResultCount = Math.min(Math.max(options.limit ?? 20, 1), 20);
  const radius = Math.min(Math.max(options.radiusMeters ?? 50000, 100), 50000);

  const response = await axios.post<{ places?: GooglePlace[] }>(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      includedTypes: ["restaurant"],
      maxResultCount,
      rankPreference: "POPULARITY",
      locationRestriction: {
        circle: {
          center: {
            latitude: options.lat ?? getDefaultSearchCenter().latitude,
            longitude: options.lng ?? getDefaultSearchCenter().longitude
          },
          radius
        }
      }
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.googlePlacesApiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.location"
      }
    }
  );

  return (response.data.places ?? [])
    .filter(place => Boolean(place.id) && typeof place.rating === "number" && place.rating >= minRating)
    .map(place => ({
      googlePlaceId: place.id,
      name: place.displayName?.text ?? "Unnamed restaurant",
      address: place.formattedAddress ?? "",
      rating: place.rating,
      photoUrl: place.photos?.[0]?.name
        ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=800&key=${config.googlePlacesApiKey}`
        : null,
      lat: place.location?.latitude,
      lng: place.location?.longitude
    }))
    .filter(place => place.googlePlaceId && typeof place.lat === "number" && typeof place.lng === "number");
}
