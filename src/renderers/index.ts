import { earthRenderer } from './earth';
import { marsRenderer } from './mars';
import { registerPlanetRenderer, getPlanetRenderer } from './planet-detail-renderer';

[earthRenderer, marsRenderer].forEach(registerPlanetRenderer);

export { getPlanetRenderer };
