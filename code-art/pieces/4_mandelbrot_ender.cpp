// 程序与艺术 · Tweetable Mathematical Art
// @rank 4
// @votes 122
// @title Mandelbrot
// @author Martin Ender
// @url https://codegolf.stackexchange.com/a/35601
// @license CC BY-SA 3.0
// @read u8
//
// The three function bodies below are the first version from Martin Ender's answer, unchanged
// (written for the first revision of the template, hence char and red_fn / green_fn / blue_fn).
// Everything outside the three functions belongs to this repository.
#define TWEET_T unsigned char
#include "tweet.h"
char green_fn(int,int);
char blue_fn(int,int);

char red_fn(int i,int j){
    float x=0,y=0;int k;for(k=0;k++<256;){float a=x*x-y*y+(i-768.0)/512;y=2*x*y+(j-512.0)/512;x=a;if(x*x+y*y>4)break;}return k>31?256:k*8;
}
char green_fn(int i,int j){
    float x=0,y=0;int k;for(k=0;k++<256;){float a=x*x-y*y+(i-768.0)/512;y=2*x*y+(j-512.0)/512;x=a;if(x*x+y*y>4)break;}return k>63?256:k*4;
}
char blue_fn(int i,int j){
    float x=0,y=0;int k;for(k=0;k++<256;){float a=x*x-y*y+(i-768.0)/512;y=2*x*y+(j-512.0)/512;x=a;if(x*x+y*y>4)break;}return k;
}

TWEET_MAIN(red_fn, green_fn, blue_fn)
