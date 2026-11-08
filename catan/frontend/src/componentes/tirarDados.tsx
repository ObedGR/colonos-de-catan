import { useEffect, useState } from 'react';
import './tirarDados.css';
import { DURACION_ANIMACION_DADOS } from '../common/dados';

// El resultado siempre llega desde el evento "dados" de CatanRoom.
// No se generan números en el cliente, para que todos vean la misma tirada.
export interface ResultadoDados {
  dado1: number;
  dado2: number;
  suma: number;
}

interface Props {
  resultado: ResultadoDados | null;
  puedeLanzar: boolean;
  lanzando: boolean;
  onLanzar: () => void;
}

const CARAS_DADO = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const;

function caraDado(valor: number): string {
  // El backend solo produce valores de 1 a 6. La alternativa evita que un
  // dato inesperado rompa el panel mientras se mantiene visible el número.
  return CARAS_DADO[valor - 1] ?? String(valor);
}

function TirarDados({ resultado, puedeLanzar, lanzando, onLanzar }: Props) {
  const [girando, setGirando] = useState(false);
  // Cambiar la key del <img> reinicia el GIF desde su primer fotograma.
  const [tirada, setTirada] = useState(0);

  useEffect(() => {
    if (!girando) return;
    const temporizador = setTimeout(() => setGirando(false), DURACION_ANIMACION_DADOS);
    return () => clearTimeout(temporizador);
  }, [girando]);

  function tirar() {
    if (!puedeLanzar || lanzando || girando) return;
    setTirada((anterior) => anterior + 1);
    setGirando(true);
    onLanzar();
  }

  const estado = girando || lanzando
    ? 'Lanzando dados…'
    : puedeLanzar
      ? 'Es tu turno: lanza los dados.'
      : 'Espera tu turno y la fase de dados.';

  return (
    <section className="tirarDados" aria-labelledby="tirar-dados-titulo">
      <h2 id="tirar-dados-titulo" className="tirarDados__titulo">Dados</h2>
      <p className="tirarDados__estado" role="status">{estado}</p>

      {girando ? (
        <div className="tirarDados__animacion">
          <img key={tirada} src="/gif/Dados.gif" alt="Dados girando" />
        </div>
      ) : resultado ? (
        <>
          <div className="tirarDados__caras" aria-label={`Resultado: ${resultado.dado1} y ${resultado.dado2}`}>
            <span className="tirarDados__dado" aria-label={`Primer dado: ${resultado.dado1}`}>
              {caraDado(resultado.dado1)}
            </span>
            <span className="tirarDados__dado" aria-label={`Segundo dado: ${resultado.dado2}`}>
              {caraDado(resultado.dado2)}
            </span>
          </div>
          <p className="tirarDados__total">Total: <strong>{resultado.suma}</strong></p>
        </>
      ) : (
        <p className="tirarDados__sinResultado">Aún no hay una tirada.</p>
      )}

      <button
        type="button"
        className="tema-btn tema-btn--ladrillo tema-btn--chico tirarDados__boton"
        onClick={tirar}
        disabled={!puedeLanzar || lanzando || girando}
      >
        {girando || lanzando ? 'Lanzando…' : 'Lanzar dados'}
      </button>
    </section>
  );
}

export default TirarDados;
