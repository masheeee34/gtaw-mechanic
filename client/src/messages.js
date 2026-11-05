// Error codes come from the client itself and from the server (GtawMechanic.Core.Errors).
const MESSAGES = {
  busy: 'Vous travaillez déjà sur ce véhicule.',
  cancelled: 'Réparation annulée.',
  cannot_reach: "Impossible d'atteindre cette partie du véhicule.",
  db_error: 'La base de données du garage est indisponible, réessayez plus tard.',
  db_unavailable: 'La base de données du garage est indisponible, réessayez plus tard.',
  forbidden: "Vous n'êtes pas mécanicien certifié.",
  minigame_failed: 'La réparation a échoué, réessayez.',
  no_control: "Quelqu'un d'autre contrôle ce véhicule.",
  no_part: "Vous n'avez pas la pièce en main.",
  too_far_from_rack: 'Rapprochez-vous du stock de pièces.',
  no_session: "L'inspection a été fermée.",
  not_in_garage: 'Vous devez être dans un garage.',
  not_networked: 'Ce véhicule ne peut pas être réparé.',
  nothing_to_repair: "Cette pièce n'a pas besoin d'être réparée.",
  out_of_stock: 'Pas assez de pièces en stock.',
  timeout: 'Le garage ne répond pas, réessayez.',
  too_far: 'Rapprochez-vous du véhicule.',
  unknown_garage: 'Requête invalide.',
  unknown_part: 'Requête invalide.',
  vehicle_not_found: "Le véhicule n'est plus là.",
};

export function errorMessage(code) {
  return MESSAGES[code] ?? 'Une erreur est survenue, réessayez.';
}
