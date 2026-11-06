// A connected land strip for reduced polity fixtures. Production supplies the
// full terrain and HistoryRegions' heap instead of this test-only construction.
module.exports=function militaryFixtureTerrain(G,R,h){
  const N=h.W*h.H;h.NB=new Int32Array(N*8).fill(-1);h.eN=new Float32Array(N);h.slopeN=new Float32Array(N);h.cellKm=24;
  const DX=[-1,0,1,-1,1,-1,0,1],DY=[-1,-1,-1,0,0,1,1,1];
  for(let i=0;i<N;i++){const x=i%h.W,y=Math.floor(i/h.W);for(let d=0;d<8;d++){const xx=x+DX[d],yy=y+DY[d];if(xx>=0&&xx<h.W&&yy>=0&&yy<h.H)h.NB[i*8+d]=yy*h.W+xx;}}
  h.gdist=(a,b)=>Math.hypot(a%h.W-b%h.W,Math.floor(a/h.W)-Math.floor(b/h.W));
  R.eN=new Float32Array(R.nR+1);R.slope=new Float32Array(R.nR+1);R.hab=new Float32Array(R.nR+1).fill(1);
  R.Heap=G.HistoryRegions.Heap;R.regionOf=new Int32Array(N);R.area=new Float64Array(R.nR+1);for(let r=1;r<=R.nR;r++){R.center[r]=r-1;R.regionOf[r-1]=r;R.area[r]=100;}
};
