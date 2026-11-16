// Tweetable Mathematical Art
// @rank 9
// @votes 81
// @title Buddhabrot
// @author Martin Ender
// @url https://codegolf.stackexchange.com/a/35897
// @license CC BY-SA 3.0
// @read le16
// @cxx clang++ -O2 -std=c++11 -w -fno-strict-return
// @slow
//
// The three function bodies below are the first version from Martin Ender's answer, unchanged.
// Everything outside the three functions belongs to this repository.
//
// The whole picture is computed inside the first call of RD: 4095 x 4095 starting points, up to
// 500,000 iterations each (the author reports 6 to 7 hours on his machine). GR doubles as the
// counter (negative i) and BL as the iteration (negative i).
//
// Two things this 2014 code relies on, and how the build keeps them working:
// - GR and BL have paths that end without a return statement. Current compilers may treat such
//   a path as unreachable and delete the code on it, so this piece is built with clang++ and
//   -fno-strict-return, which keeps the code and returns an unspecified value, as compilers did then.
// - When an orbit has y just below 2, GR counts it in row 1024, one row past the end of its
//   1024 x 1024 table. TWEET_GUARD in tweet.h makes sure those 4 KiB hold nothing the program uses.
#define TWEET_T unsigned short
#define TWEET_GUARD
#include "tweet.h"
unsigned short GR(int,int);
unsigned short BL(int,int);

unsigned short RD(int i,int j){
    #define f(a,b)for(a=0;++a<b;)
    #define D float x=0,y=0
    static int z,m,n;if(!z){z=1;f(m,4096)f(n,4096)BL(m-4096,n-4096);};return GR(i,j);
}
unsigned short GR(int i,int j){
    #define R a=x*x-y*y+i/1024.+2;y=2*x*y+j/1024.+2
    static float c[DIM][DIM],p;if(i>=0)return(p=c[i][j])>DM1?DM1:p;c[j+DIM][i/2+DIM]+=i%2*2+1;
}
unsigned short BL(int i,int j){
    D,a,k,p=0;if(i<0)f(k,5e5){R;x=a;if(x*x>4||y*y>4)break;GR(int((x-2)*256)*2-p,(y-2)*256);if(!p&&k==5e5-1){x=y=k=0;p=1;}}else{return GR(i,j);}
}

TWEET_MAIN(RD, GR, BL)
