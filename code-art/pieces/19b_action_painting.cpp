// Tweetable Mathematical Art
// @rank 19
// @votes 44
// @title Action Painting
// @author trichoplax
// @url https://codegolf.stackexchange.com/a/36187
// @license CC BY-SA 4.0
// @read u8
//
// trichoplax's answer with the colour arguments of its third picture. The answer's code has
// E(21) in RD and in GR; the pictures that follow it differ only in those two arguments, which
// the answer gives in each picture's caption ("action painting 63, 49" for this one: red 63,
// green 49). Nothing else is changed. Everything outside the three functions belongs to this
// repository.
// rand() is never seeded, so the picture is the same on every run with the same C library;
// it has the look of the author's picture, not the same strokes.
#define TWEET_T unsigned char
#include "tweet.h"
unsigned char GR(int,int);
unsigned char BL(int,int);

unsigned char RD(int i,int j){
#define E(q)return i+j?T-((T-BL(i,j))*q):T;
#define T 255
#define R .1*(rand()%11)
#define M(v)(v>0&v<DIM)*int(v)
#define J [j]*250;
E(63)}

unsigned char GR(int i,int j){
#define S DIM][DIM],n=1e3,r,a,s,c,x,y,d=.1,e,f;for(;i+j<1&&n--;x=R*DM1,y=R*DM1,s=R*R*R*R,a=R*7,r=s*T)for(c=R;r>1;x+=s*cos(a),y+=s*sin
E(49)}

unsigned char BL(int i,int j){static float m[S(a),d=rand()%39?d:-d,a+=d*R,s*=1+R/99,r*=.998)for(e=-r;e++<r;)for(f=-r;f++<r;)m[M(x+e)*(e*e+f*f<r)][M(y+f)]=c;return T-m[i]J}

TWEET_MAIN(RD, GR, BL)
