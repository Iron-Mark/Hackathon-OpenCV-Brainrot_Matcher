export type Detection = {
  label: string;
  score: number;
  box: { x: number; y: number; w: number; h: number };
};

export type PipelineId = "faces" | "objects" | "edges" | "grayscale" | "blur";
