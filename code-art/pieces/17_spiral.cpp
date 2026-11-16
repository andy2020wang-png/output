// Tweetable Mathematical Art
// @rank 17
// @votes 50
// @title Spiral (140 exactly)
// @author Steven Moreland
// @url https://codegolf.stackexchange.com/a/35954
// @license CC BY-SA 3.0
// @read u8
//
// The three function bodies below are the main version from Steven Moreland's answer,
// unchanged. Everything outside the three functions belongs to this repository.
// "140 exactly" is the author's count for the three bodies together.
#define TWEET_T unsigned char
#include "tweet.h"
unsigned char GR(int,int);
unsigned char BL(int,int);

unsigned char RD(int i,int j){
    return DIM-BL(2*i,2*j);
}
unsigned char GR(int i,int j){
    return BL(j,i)+128;
}
unsigned char BL(int i,int j){
    i-=512;j-=512;int d=sqrt(i*i+j*j);return d+atan2(j,i)*82+sin(_cr(d*d))*32+sin(atan2(j,i)*10)*64;
}

TWEET_MAIN(RD, GR, BL)
