// Roster of districts, pastors and congregations — source: "Distritos 2026",
// actualizado 4-9-2026. `members` is the membership snapshot as of that date.
//
// Pastor names come from the source as "Apellido(s) Nombre(s)"; they are split
// here explicitly rather than guessed at import time, because the number of
// surnames varies from one to two and no rule gets every row right.

export type CongregationType = "IGLESIA" | "GRUPO"

export type CongregationSeed = {
  name: string
  type: CongregationType
  members: number
}

export type DistrictSeed = {
  name: string
  pastor: { firstName: string; lastName: string }
  congregations: CongregationSeed[]
}

/** Membership figures are the snapshot this record belongs to. */
export const SNAPSHOT_YEAR = 2026
export const SNAPSHOT_MONTH = 9

/** Start of the pastoral year the roster describes. */
export const ASSIGNMENT_START = new Date("2026-01-01T00:00:00.000Z")

export const DISTRITOS_2026: DistrictSeed[] = [
  {
    name: "Avellaneda",
    pastor: { firstName: "Nestor Gabriel", lastName: "Cerdá Pissano" },
    congregations: [
      { name: "Avellaneda", type: "IGLESIA", members: 316 },
      { name: "Quilmes", type: "IGLESIA", members: 92 },
      { name: "Villa Domínico", type: "IGLESIA", members: 74 },
      { name: "Wilde", type: "IGLESIA", members: 60 },
    ],
  },
  {
    name: "Berazategui",
    pastor: { firstName: "Leandro Elías", lastName: "Maurin" },
    congregations: [
      { name: "Berazategui", type: "IGLESIA", members: 133 },
      { name: "Bustillo", type: "IGLESIA", members: 63 },
      { name: "Ezpeleta", type: "IGLESIA", members: 140 },
      { name: "Guillermo Hudson", type: "IGLESIA", members: 132 },
      { name: "Ranelagh", type: "IGLESIA", members: 62 },
      { name: "San José", type: "IGLESIA", members: 87 },
      { name: "Villa Mitre", type: "IGLESIA", members: 116 },
    ],
  },
  {
    name: "Boedo",
    pastor: { firstName: "Darío Marcelo", lastName: "Caviglione" },
    congregations: [
      { name: "Bajo Flores", type: "IGLESIA", members: 147 },
      { name: "Bajo Flores Sur", type: "GRUPO", members: 56 },
      { name: "Boedo", type: "IGLESIA", members: 199 },
      { name: "Piedra Buena", type: "GRUPO", members: 52 },
      { name: "Villa Lugano", type: "IGLESIA", members: 539 },
      { name: "Villa Soldati", type: "IGLESIA", members: 136 },
    ],
  },
  {
    name: "Castelar",
    pastor: { firstName: "Carlos Daniel", lastName: "Ramos Arn" },
    congregations: [
      { name: "Barrio Marina", type: "IGLESIA", members: 132 },
      { name: "Castelar", type: "IGLESIA", members: 246 },
      { name: "Ituzaingó", type: "IGLESIA", members: 141 },
      { name: "Libertad", type: "IGLESIA", members: 73 },
      { name: "Pontevedra", type: "GRUPO", members: 52 },
    ],
  },
  {
    name: "Coreana",
    pastor: { firstName: "Wonki", lastName: "Lee" },
    congregations: [{ name: "Coreana", type: "IGLESIA", members: 163 }],
  },
  {
    name: "Del Centro",
    pastor: { firstName: "David Miguel", lastName: "Brizuela" },
    congregations: [
      { name: "Barracas", type: "IGLESIA", members: 203 },
      { name: "del Centro", type: "IGLESIA", members: 323 },
      { name: "la Boca", type: "IGLESIA", members: 180 },
      { name: "Parque Patricios", type: "IGLESIA", members: 177 },
      { name: "Retiro", type: "IGLESIA", members: 129 },
    ],
  },
  {
    name: "Florencio Varela",
    pastor: { firstName: "Santiago", lastName: "Fornes" },
    congregations: [
      { name: "Bosques", type: "IGLESIA", members: 56 },
      { name: "Florencio Varela", type: "IGLESIA", members: 111 },
      { name: "Km. 26, Fcio. Varela", type: "IGLESIA", members: 47 },
      { name: "la Capilla", type: "IGLESIA", members: 68 },
      { name: "Villa Angélica", type: "IGLESIA", members: 53 },
      { name: "Villa Mónica", type: "IGLESIA", members: 79 },
      { name: "Zeballos", type: "GRUPO", members: 14 },
    ],
  },
  {
    name: "González Catán",
    pastor: { firstName: "Lucas Esteban", lastName: "Martínez" },
    congregations: [
      { name: "Barrio Esperanza, González Catán", type: "IGLESIA", members: 71 },
      { name: "Barrio los Ceibos", type: "IGLESIA", members: 59 },
      { name: "González Catán", type: "IGLESIA", members: 59 },
      { name: "Horeb, González Catán", type: "GRUPO", members: 29 },
      { name: "Puente Ezcurra", type: "IGLESIA", members: 141 },
      { name: "Villa Dorrego", type: "IGLESIA", members: 73 },
    ],
  },
  {
    name: "Guernica",
    pastor: { firstName: "Abel Isaías", lastName: "Juchani" },
    congregations: [
      { name: "Glew", type: "IGLESIA", members: 141 },
      { name: "Guernica", type: "IGLESIA", members: 235 },
      { name: "las Flores", type: "GRUPO", members: 46 },
      { name: "Lobos", type: "GRUPO", members: 60 },
      { name: "Saladillo", type: "GRUPO", members: 21 },
      { name: "San Vicente", type: "IGLESIA", members: 83 },
    ],
  },
  {
    name: "Instituto Balcarce",
    pastor: { firstName: "Alvaro Iván", lastName: "Gamarra Navarro" },
    congregations: [
      { name: "Balcarce", type: "IGLESIA", members: 85 },
      { name: "Instituto Balcarce", type: "IGLESIA", members: 450 },
    ],
  },
  {
    name: "La Costa",
    pastor: { firstName: "Julian Daniel", lastName: "Lorenzo" },
    congregations: [
      { name: "Las Toninas", type: "GRUPO", members: 37 },
      { name: "Ostende", type: "GRUPO", members: 61 },
      { name: "San Bernardo", type: "IGLESIA", members: 92 },
      { name: "Villa Gesell Norte", type: "IGLESIA", members: 78 },
      { name: "Villa Gesell Sur", type: "IGLESIA", members: 60 },
    ],
  },
  {
    name: "La Plata Centro",
    pastor: { firstName: "Fernando Sebastián", lastName: "Lapalma" },
    congregations: [
      { name: "Berisso", type: "IGLESIA", members: 152 },
      { name: "Ensenada", type: "GRUPO", members: 60 },
      { name: "La Plata Centro", type: "IGLESIA", members: 324 },
      { name: "La Plata Diagonal", type: "IGLESIA", members: 120 },
      { name: "Tolosa", type: "GRUPO", members: 50 },
      { name: "Villa Elisa", type: "IGLESIA", members: 109 },
    ],
  },
  {
    name: "La Plata Sur",
    pastor: { firstName: "Norberto Luis", lastName: "Gonzalez" },
    congregations: [
      { name: "Abasto", type: "IGLESIA", members: 129 },
      { name: "Chascomús", type: "GRUPO", members: 40 },
      { name: "Dolores", type: "IGLESIA", members: 39 },
      { name: "Lisandro Olmos", type: "IGLESIA", members: 316 },
      { name: "los Hornos", type: "IGLESIA", members: 109 },
      { name: "Melchor Romero", type: "IGLESIA", members: 117 },
    ],
  },
  {
    name: "Laferrere",
    pastor: { firstName: "Claudio Federico", lastName: "Silva" },
    congregations: [
      { name: "Barrio Independencia", type: "IGLESIA", members: 89 },
      { name: "Barrio Primero de Mayo", type: "GRUPO", members: 2 },
      { name: "Laferrere Centro", type: "IGLESIA", members: 208 },
      { name: "Laferrere Norte", type: "GRUPO", members: 89 },
      { name: "Laferrere Sur", type: "GRUPO", members: 53 },
    ],
  },
  {
    name: "Lomas de Zamora",
    pastor: { firstName: "Jorge Eduardo", lastName: "Santillan" },
    congregations: [
      { name: "Banfield", type: "GRUPO", members: 59 },
      { name: "Lanús Este", type: "IGLESIA", members: 107 },
      { name: "Lomas de Zamora", type: "IGLESIA", members: 182 },
      { name: "Santa Marta", type: "GRUPO", members: 32 },
      { name: "Villa Barceló", type: "IGLESIA", members: 170 },
    ],
  },
  {
    name: "Mar del Plata Centro",
    pastor: { firstName: "Jose Santos", lastName: "Reyes" },
    congregations: [
      { name: "Barrio Lujan", type: "IGLESIA", members: 45 },
      { name: "Barrio Regional", type: "IGLESIA", members: 65 },
      { name: "Mar del Plata Centro", type: "IGLESIA", members: 901 },
      { name: "Unidad Penal Batán", type: "GRUPO", members: 60 },
    ],
  },
  {
    name: "Mar del Plata Sur",
    pastor: { firstName: "Julian Matias", lastName: "Doni Garcia" },
    congregations: [
      { name: "Barrio Batán", type: "IGLESIA", members: 48 },
      { name: "Barrio Belgrano", type: "IGLESIA", members: 31 },
      { name: "Las Heras", type: "IGLESIA", members: 53 },
      { name: "Mar del Plata Sur", type: "IGLESIA", members: 74 },
      { name: "Miramar", type: "IGLESIA", members: 59 },
    ],
  },
  {
    name: "Merlo",
    pastor: { firstName: "Guillermo Marcelo", lastName: "Heinze" },
    congregations: [
      { name: "Barrio Matera", type: "IGLESIA", members: 34 },
      { name: "Barrio Samoré", type: "IGLESIA", members: 53 },
      { name: "Marcos Paz", type: "GRUPO", members: 31 },
      { name: "Mariano Acosta", type: "IGLESIA", members: 93 },
      { name: "Merlo", type: "IGLESIA", members: 234 },
      { name: "Parque San Martín", type: "IGLESIA", members: 41 },
    ],
  },
  {
    name: "Monte Grande",
    pastor: { firstName: "Marcelo Claudio", lastName: "Mammana" },
    congregations: [
      { name: "Cañuelas", type: "IGLESIA", members: 60 },
      { name: "Carlos Spegazzini", type: "IGLESIA", members: 83 },
      { name: "Ezeiza", type: "IGLESIA", members: 144 },
      { name: "Monte Grande", type: "IGLESIA", members: 98 },
      { name: "Monte Grande Sur", type: "IGLESIA", members: 96 },
      { name: "Tristán Suárez", type: "IGLESIA", members: 97 },
    ],
  },
  {
    name: "Moreno",
    pastor: { firstName: "Eduardo Mauro", lastName: "Velardo Straface" },
    congregations: [
      { name: "General Rodríguez", type: "IGLESIA", members: 217 },
      { name: "General Rodríguez Sur (Francisco Álvarez)", type: "IGLESIA", members: 82 },
      { name: "Moreno", type: "IGLESIA", members: 513 },
      { name: "Paso del Rey", type: "GRUPO", members: 23 },
    ],
  },
  {
    name: "Morón",
    pastor: { firstName: "Javier Alejandro", lastName: "Badano" },
    congregations: [
      { name: "Barrio los Pinos", type: "IGLESIA", members: 99 },
      { name: "Morón", type: "IGLESIA", members: 442 },
      { name: "Rafael Castillo", type: "GRUPO", members: 22 },
      { name: "Texalar", type: "IGLESIA", members: 180 },
    ],
  },
  {
    name: "Núñez",
    pastor: { firstName: "Rubén Darío", lastName: "Barceló" },
    congregations: [
      { name: "Belgrano", type: "IGLESIA", members: 258 },
      { name: "Clínica Belgrano", type: "GRUPO", members: 78 },
      { name: "Núñez", type: "IGLESIA", members: 236 },
      { name: "Villa Devoto", type: "IGLESIA", members: 61 },
      { name: "Villa Urquiza", type: "IGLESIA", members: 83 },
    ],
  },
  {
    name: "Palermo",
    pastor: { firstName: "Nelson Fabián", lastName: "Stoll" },
    congregations: [
      { name: "Caballito", type: "IGLESIA", members: 148 },
      { name: "Comunidad Brasilera", type: "GRUPO", members: 57 },
      { name: "Comunidad Hebrea", type: "GRUPO", members: 31 },
      { name: "Palermo", type: "IGLESIA", members: 1385 },
    ],
  },
  {
    name: "Parque Avellaneda",
    pastor: { firstName: "Bruno Sebastián", lastName: "Salvo" },
    congregations: [
      { name: "Flores", type: "IGLESIA", members: 222 },
      { name: "Mataderos", type: "IGLESIA", members: 123 },
      { name: "Parque Avellaneda Centro", type: "IGLESIA", members: 659 },
      { name: "Parque Avellaneda Oeste", type: "IGLESIA", members: 334 },
      { name: "Villa del Parque", type: "GRUPO", members: 50 },
    ],
  },
  {
    name: "Rafael Calzada",
    pastor: { firstName: "Ramon Antonio", lastName: "Valenzuela" },
    congregations: [
      { name: "Burzaco", type: "IGLESIA", members: 144 },
      { name: "Claypole", type: "GRUPO", members: 78 },
      { name: "Rafael Calzada", type: "IGLESIA", members: 151 },
      { name: "Rayo de Sol", type: "IGLESIA", members: 89 },
      { name: "Solano", type: "IGLESIA", members: 92 },
      { name: "Solano Este", type: "IGLESIA", members: 70 },
    ],
  },
  {
    name: "San Justo - Liniers",
    pastor: { firstName: "Moisés Elías", lastName: "Rivero Dupleich" },
    congregations: [
      { name: "Isidro Casanova", type: "IGLESIA", members: 97 },
      { name: "Liniers", type: "IGLESIA", members: 187 },
      { name: "Ramos Mejía", type: "IGLESIA", members: 134 },
      { name: "San Justo", type: "IGLESIA", members: 368 },
      { name: "Villa Madero", type: "IGLESIA", members: 49 },
    ],
  },
  {
    name: "Tandil",
    pastor: { firstName: "Matias Diego", lastName: "Salinas" },
    congregations: [
      { name: "Azul", type: "GRUPO", members: 13 },
      { name: "Barrio Palermo", type: "GRUPO", members: 26 },
      { name: "Olavarría Centro", type: "IGLESIA", members: 102 },
      { name: "Olavarría Sur", type: "GRUPO", members: 19 },
      { name: "Tandil", type: "IGLESIA", members: 109 },
    ],
  },
  {
    name: "Valentín Alsina",
    pastor: { firstName: "Emmanuel Diego", lastName: "Hassanie Iglesias" },
    congregations: [
      { name: "Lanús Oeste", type: "IGLESIA", members: 141 },
      { name: "Monte Chingolo", type: "GRUPO", members: 43 },
      { name: "Nueva Pompeya", type: "GRUPO", members: 70 },
      { name: "Parque Udabe", type: "IGLESIA", members: 65 },
      { name: "Valentín Alsina", type: "IGLESIA", members: 194 },
    ],
  },
  {
    name: "Villa Celina",
    pastor: { firstName: "Cecilio Luis", lastName: "Panessi Ortiz" },
    congregations: [
      { name: "17 de Noviembre", type: "GRUPO", members: 105 },
      { name: "Barrio José Hernández", type: "IGLESIA", members: 135 },
      { name: "Barrio Sarmiento", type: "IGLESIA", members: 165 },
      { name: "Villa Celina", type: "IGLESIA", members: 283 },
    ],
  },
  {
    name: "Villa Lamadrid",
    pastor: { firstName: "Samuel Elias", lastName: "Menón Aranda" },
    congregations: [
      { name: "9 de Abril, Monte Sinaí", type: "GRUPO", members: 60 },
      { name: "Barrio Tongui", type: "IGLESIA", members: 130 },
      { name: "Esperanza, Lomas de Zamora", type: "IGLESIA", members: 59 },
      { name: "Ingeniero Budge", type: "IGLESIA", members: 101 },
      { name: "Juan Manuel de Rosas", type: "IGLESIA", members: 142 },
      { name: "Olimpo", type: "GRUPO", members: 27 },
      { name: "Villa Lamadrid", type: "IGLESIA", members: 143 },
    ],
  },
]
